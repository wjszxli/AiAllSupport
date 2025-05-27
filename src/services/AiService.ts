import AiProvider from '@/llmProviders/AiProvider';
import { Model, Provider, Robot, RobotMessageStatus } from '@/types';
import { Message } from '@/types/message';
import { Chunk } from '@/types/chunk';
import { filterContextMessages, filterUsefulMessages } from '@/utils/message/filters';
import { findLast, throttle } from 'lodash';

import {
    MessageBlock,
    MessageBlockStatus,
    MessageBlockType,
    PlaceholderMessageBlock,
} from '@/types/messageBlock';
import messageStore from '@/store/message';
import { createStreamProcessor, StreamProcessorCallbacks } from './StreamProcessingService';
import { createBaseMessageBlock } from '@/utils/message/create';
import llmStore from '@/store/llm';
import { db } from '@/db';
import rootStore from '@/store';

// 更新单个块的逻辑，用于更新消息中的单个块
const throttledBlockUpdate = throttle(async (id, blockUpdate) => {
    console.log('throttledBlockUpdate', id, blockUpdate);
    rootStore.messageBlockStore.updateBlock(id, blockUpdate);
    await db.message_blocks.update(id, blockUpdate);
}, 150);

const cancelThrottledBlockUpdate = throttledBlockUpdate.cancel;

export const checkApiProvider = async (provider: Provider, model: Model) => {
    const ai = new AiProvider(provider);
    const result = await ai.check(model, true);
    if (result.valid && !result.error) {
        return result;
    }

    return ai.check(model, false);
};

export const getModels = async (provider: Provider) => {
    const ai = new AiProvider(provider);
    return ai.models(provider);
};

export async function fetchChatCompletion({
    messages,
    robot,
    onChunkReceived,
}: {
    messages: Message[];
    robot: Robot;
    onChunkReceived: (chunk: Chunk) => void;
}) {
    console.log('fetchChatCompletion', messages, robot);
    const provider = llmStore.providers.find((p) => p.id === robot.model?.provider);

    if (!provider) {
        throw new Error('Provider not found');
    }

    const AI = new AiProvider(provider);

    // Make sure that 'Clear Context' works for all scenarios including external tool and normal chat.
    messages = filterContextMessages(messages);
    console.log('filterContextMessages', messages);

    const lastUserMessage = findLast(messages, (m) => m.role === 'user');
    if (!lastUserMessage) {
        console.error('fetchChatCompletion returning early: Missing lastUserMessage or lastAnswer');
        return;
    }

    const filteredMessages = filterUsefulMessages(messages);
    console.log('filterUsefulMessages', filteredMessages);

    await AI.completions({
        messages: filteredMessages,
        onFilterMessages: () => {},
        onChunk: onChunkReceived,
    });
}

export const fetchAndProcessAssistantResponseImpl = async (
    topicId: string,
    robot: Robot,
    message: Message,
) => {
    try {
        let currentBlockId: string | null = null;
        let currentBlockType: MessageBlockType | null = null;
        let accumulatedContent = '';
        let callbacks: StreamProcessorCallbacks = {};
        const messageId = message.id;

        // const messagesForContext = [message];

        const allMessages = messageStore.getMessagesForTopic(topicId);
        console.log('allMessages', allMessages);
        const userMessageIndex = allMessages.findIndex((m) => m?.id === message.askId);
        const messagesForContext =
            userMessageIndex !== -1
                ? allMessages
                      .slice(0, userMessageIndex + 1)
                      .filter((m) => m && !m.status?.includes('ing'))
                : allMessages.filter((m) => m && !m.status?.includes('ing'));

        const handleBlockTransition = async (
            newBlock: MessageBlock,
            blockType: MessageBlockType,
        ) => {
            currentBlockId = newBlock.id;
            currentBlockType = blockType;
            accumulatedContent = '';
        };

        const updateBlockContent = async (content: string, status: MessageBlockStatus) => {
            if (!currentBlockId) return;
            console.log('updateBlockContent', currentBlockId, content, status);
        };

        callbacks = {
            // 开始响应
            onLLMResponseCreated: () => {
                const baseBlock = createBaseMessageBlock(messageId, MessageBlockType.UNKNOWN, {
                    status: MessageBlockStatus.PROCESSING,
                });
                handleBlockTransition(
                    baseBlock as PlaceholderMessageBlock,
                    MessageBlockType.UNKNOWN,
                );
            },

            // 文本流处理
            onTextChunk: (text) => {
                accumulatedContent += text;
                if (currentBlockId) {
                    if (currentBlockType === MessageBlockType.UNKNOWN) {
                        // 首次确定为文本块
                        currentBlockType = MessageBlockType.MAIN_TEXT;
                        // const changes = {
                        //     type: MessageBlockType.MAIN_TEXT,
                        //     content: accumulatedContent,
                        //     status: MessageBlockStatus.STREAMING,
                        // };
                        // dispatch(updateOneBlock({ id: currentBlockId, changes }));
                    } else if (currentBlockType === MessageBlockType.MAIN_TEXT) {
                        // 更新文本内容
                        throttledBlockUpdate(currentBlockId, {
                            content: accumulatedContent,
                            status: MessageBlockStatus.STREAMING,
                        });
                    }
                }
            },

            // 文本完成
            onTextComplete: async (finalText) => {
                cancelThrottledBlockUpdate();
                if (currentBlockType === MessageBlockType.MAIN_TEXT && currentBlockId) {
                    await updateBlockContent(finalText, MessageBlockStatus.SUCCESS);
                }
            },

            // 错误处理
            onError: async (error) => {
                console.log('onError', error);
                cancelThrottledBlockUpdate();
                // const isAbort = isAbortError(error);

                // 更新当前块状态
                if (currentBlockId) {
                    // const changes = {
                    //     status: isAbort ? MessageBlockStatus.PAUSED : MessageBlockStatus.ERROR,
                    // };
                    // dispatch(updateOneBlock({ id: currentBlockId, changes }));
                    // await saveUpdatedBlockToDB(currentBlockId, assistantMsgId, topicId, getState);
                }

                // 创建错误块
                // const errorBlock = createErrorBlock(
                //     assistantMsgId,
                //     {
                //         name: error.name,
                //         message: error.message || 'Stream processing error',
                //         stack: error.stack,
                //     },
                //     { status: MessageBlockStatus.SUCCESS },
                // );

                // await handleBlockTransition(errorBlock, MessageBlockType.ERROR);

                // // 更新消息状态
                // const messageUpdate = {
                //     status: isAbort ? AssistantMessageStatus.SUCCESS : AssistantMessageStatus.ERROR,
                // };
                // dispatch(
                //     newMessagesActions.updateMessage({
                //         topicId,
                //         messageId: assistantMsgId,
                //         updates: messageUpdate,
                //     }),
                // );
                // await saveUpdatesToDB(assistantMsgId, topicId, messageUpdate, []);

                // // 发送完成事件
                // EventEmitter.emit(EVENT_NAMES.MESSAGE_COMPLETE, {
                //     id: assistantMsgId,
                //     topicId,
                //     status: isAbort ? 'pause' : 'error',
                //     error: error.message,
                // });
            },

            // 完成处理
            onComplete: async (status: RobotMessageStatus, response?: Response) => {
                console.log('onComplete', status, response);
                cancelThrottledBlockUpdate();

                // 更新最后一个块状态
                if (currentBlockId && status === 'success') {
                    await updateBlockContent(accumulatedContent, MessageBlockStatus.SUCCESS);
                }

                // // 更新消息状态和使用量
                // const messageUpdates: Partial<Message> = {
                //     status,
                //     metrics: response?.metrics,
                //     usage: response?.usage,
                // };

                // dispatch(
                //     newMessagesActions.updateMessage({
                //         topicId,
                //         messageId: assistantMsgId,
                //         updates: messageUpdates,
                //     }),
                // );
                // await saveUpdatesToDB(assistantMsgId, topicId, messageUpdates, []);

                // // 自动重命名主题
                // if (status === 'success') {
                //     autoRenameTopic(assistant, topicId);
                // }

                // // 发送完成事件
                // EventEmitter.emit(EVENT_NAMES.MESSAGE_COMPLETE, {
                //     id: assistantMsgId,
                //     topicId,
                //     status,
                // });
            },
        };

        const streamProcessorCallbacks = createStreamProcessor(callbacks);

        await fetchChatCompletion({
            messages: messagesForContext,
            robot: robot,
            onChunkReceived: streamProcessorCallbacks,
        });
    } catch (error: any) {
        console.error('Error fetching chat completion:', error);
        if (message) {
            // callbacks.onError?.(error);
            throw error;
        }
    }
};
