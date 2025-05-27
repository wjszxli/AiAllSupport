import { db } from '@/db';
// import { autoRenameTopic } from '@renderer/hooks/useTopic';
import { fetchChatCompletion } from '@/services/AiService';
// import { EVENT_NAMES, EventEmitter } from '@/services/EventService';
import {
    createStreamProcessor,
    type StreamProcessorCallbacks,
} from '@/services/StreamProcessingService';
import { RobotMessageStatus, type Model, type Robot, type Topic } from '@/types';
import type { Message } from '@/types/message';
import { MessageBlockStatus, MessageBlockType } from '@/types/messageBlock';
import { isAbortError } from '@/utils/error';
import {
    createRobotMessage,
    createBaseMessageBlock,
    createErrorBlock,
    resetRobotMessage,
} from '@/utils/message/create';
// import { getTopicQueue, waitForTopicQueue } from '@/utils/queue';
import { getTopicQueue } from '@/utils/queue';
import { throttle } from 'lodash';
import { runInAction } from 'mobx';

import type { RootStore } from './index';
import { MessageBlock } from '@/types/messageBlock';

export class MessageThunkService {
    private rootStore: RootStore;

    constructor(rootStore: RootStore) {
        this.rootStore = rootStore;
    }

    // 节流更新函数
    private throttledBlockUpdate = throttle((blockId: string, changes: Partial<MessageBlock>) => {
        runInAction(() => {
            this.rootStore.messageBlockStore.updateBlock(blockId, changes);
        });
        // 同时更新数据库
        this.saveBlockToDB(blockId);
    }, 150);

    private cancelThrottledBlockUpdate = this.throttledBlockUpdate.cancel;

    // 保存消息和块到数据库
    private async saveMessageAndBlocksToDB(
        message: Message,
        blocks: MessageBlock[],
        messageIndex: number = -1,
    ) {
        try {
            if (blocks.length > 0) {
                // 序列化 MobX 对象
                const serializedBlocks = blocks.map((block) => JSON.parse(JSON.stringify(block)));
                await db.message_blocks.bulkPut(serializedBlocks);
            }
            const topic = await db.topics.get(message.topicId);
            if (topic) {
                const _messageIndex = topic.messages.findIndex((m) => m.id === message.id);
                const updatedMessages = [...topic.messages];

                if (_messageIndex !== -1) {
                    updatedMessages[_messageIndex] = message;
                } else {
                    if (messageIndex !== -1) {
                        updatedMessages.splice(messageIndex, 0, message);
                    } else {
                        updatedMessages.push(message);
                    }
                }
                await db.topics.update(message.topicId, { messages: updatedMessages });
            }
        } catch (error) {
            console.error(
                `[saveMessageAndBlocksToDB] Failed to save message ${message.id}:`,
                error,
            );
        }
    }

    // 保存单个块到数据库
    private async saveBlockToDB(blockId: string) {
        const block = this.rootStore.messageBlockStore.getBlockById(blockId);
        if (block) {
            try {
                // 将 MobX 对象转换为纯 JavaScript 对象
                const serializedBlock = JSON.parse(JSON.stringify(block));
                await db.message_blocks.put(serializedBlock);
            } catch (error) {
                console.error(`[saveBlockToDB] Failed to save block ${blockId}:`, error);
            }
        }
    }

    // 保存更新到数据库
    private async saveUpdatesToDB(
        messageId: string,
        topicId: string,
        messageUpdates: Partial<Message>,
        blocksToUpdate: MessageBlock[],
    ) {
        try {
            if (blocksToUpdate.length > 0) {
                // 序列化 MobX 对象
                const serializedBlocks = blocksToUpdate.map((block) =>
                    JSON.parse(JSON.stringify(block)),
                );
                await db.message_blocks.bulkPut(serializedBlocks);
            }

            if (Object.keys(messageUpdates).length > 0) {
                await db.topics
                    .where('id')
                    .equals(topicId)
                    .modify((topic) => {
                        if (!topic) return;
                        const messageIndex = topic.messages.findIndex((m) => m.id === messageId);
                        if (messageIndex !== -1) {
                            Object.assign(topic.messages[messageIndex], messageUpdates);
                        }
                    });
            }
        } catch (error) {
            console.error(`[saveUpdatesToDB] Failed for message ${messageId}:`, error);
        }
    }

    async fetchAndProcessAssistantResponse(
        topicId: string,
        robot: Robot,
        assistantMessage: Message,
    ) {
        const assistantMsgId = assistantMessage.id;
        let callbacks: StreamProcessorCallbacks = {};

        try {
            // 1. 设置加载状态
            runInAction(() => {
                this.rootStore.messageStore.setTopicLoading(topicId, true);
            });

            // 2. 核心状态变量
            let currentBlockId: string | null = null;
            let currentBlockType: MessageBlockType | null = null;
            let accumulatedContent = '';

            // 3. 准备上下文消息
            const allMessages = this.rootStore.messageStore.getMessagesForTopic(topicId);
            const userMessageIndex = allMessages.findIndex(
                (m: { id: string }) => m?.id === assistantMessage.askId,
            );
            const messagesForContext =
                userMessageIndex !== -1
                    ? allMessages
                          .slice(0, userMessageIndex + 1)
                          .filter((m: { status: string }) => m && !m.status?.includes('ing'))
                    : allMessages.filter(
                          (m: { status: string }) => m && !m.status?.includes('ing'),
                      );

            // 4. 块转换处理函数
            const handleBlockTransition = async (
                newBlock: MessageBlock,
                blockType: MessageBlockType,
            ) => {
                currentBlockId = newBlock.id;
                currentBlockType = blockType;
                accumulatedContent = '';

                // MobX 状态更新
                runInAction(() => {
                    this.rootStore.messageBlockStore.upsertBlock(newBlock);
                    this.rootStore.messageStore.upsertBlockReference(
                        assistantMsgId,
                        newBlock.id,
                        newBlock.status,
                    );
                });

                // 保存到数据库
                await this.saveBlockToDB(newBlock.id);
            };

            // 5. 更新块内容的通用函数
            const updateBlockContent = async (content: string, status: MessageBlockStatus) => {
                if (!currentBlockId) return;

                runInAction(() => {
                    this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                        content,
                        status,
                    });
                });

                if (status === MessageBlockStatus.SUCCESS) {
                    await this.saveBlockToDB(currentBlockId);
                }
            };

            // 6. 核心回调函数
            callbacks = {
                // 开始响应
                onLLMResponseCreated: () => {
                    const baseBlock = createBaseMessageBlock(
                        assistantMsgId,
                        MessageBlockType.UNKNOWN,
                        {
                            status: MessageBlockStatus.PROCESSING,
                        },
                    );
                    handleBlockTransition(baseBlock, MessageBlockType.UNKNOWN);
                },

                // 文本流处理
                onTextChunk: (text: string) => {
                    accumulatedContent += text;
                    if (currentBlockId) {
                        if (currentBlockType === MessageBlockType.UNKNOWN) {
                            // 首次确定为文本块
                            runInAction(() => {
                                this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                    type: MessageBlockType.MAIN_TEXT,
                                    content: accumulatedContent,
                                    status: MessageBlockStatus.STREAMING,
                                });
                            });
                            currentBlockType = MessageBlockType.MAIN_TEXT;
                        } else if (currentBlockType === MessageBlockType.MAIN_TEXT) {
                            // 节流更新文本内容
                            this.throttledBlockUpdate(currentBlockId, {
                                content: accumulatedContent,
                                status: MessageBlockStatus.STREAMING,
                            });
                        }
                    }
                },

                // 文本完成
                onTextComplete: async (finalText: string) => {
                    this.cancelThrottledBlockUpdate();
                    if (currentBlockType === MessageBlockType.MAIN_TEXT && currentBlockId) {
                        await updateBlockContent(finalText, MessageBlockStatus.SUCCESS);
                    }
                },

                // 错误处理
                onError: async (error: { name: string; message: string; stack: any }) => {
                    this.cancelThrottledBlockUpdate();
                    const isAbort = isAbortError(error);

                    // 更新当前块状态
                    if (currentBlockId) {
                        runInAction(() => {
                            this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                status: isAbort
                                    ? MessageBlockStatus.PAUSED
                                    : MessageBlockStatus.ERROR,
                            });
                        });
                        await this.saveBlockToDB(currentBlockId);
                    }

                    // 创建错误块
                    const errorBlock = createErrorBlock(
                        assistantMsgId,
                        {
                            name: error.name,
                            message: error.message || 'Stream processing error',
                            stack: error.stack,
                        },
                        { status: MessageBlockStatus.SUCCESS },
                    );

                    await handleBlockTransition(errorBlock, MessageBlockType.ERROR);

                    // 更新消息状态
                    const messageUpdate = {
                        status: isAbort ? RobotMessageStatus.SUCCESS : RobotMessageStatus.ERROR,
                    };
                    runInAction(() => {
                        this.rootStore.messageStore.updateMessage(assistantMsgId, messageUpdate);
                    });
                    await this.saveUpdatesToDB(assistantMsgId, topicId, messageUpdate, []);

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
                    this.cancelThrottledBlockUpdate();

                    // 更新最后一个块状态
                    if (currentBlockId && status === 'success') {
                        await updateBlockContent(accumulatedContent, MessageBlockStatus.SUCCESS);
                    }

                    // 更新消息状态和使用量
                    const messageUpdates: Partial<Message> = {
                        status,
                        metrics: response?.metrics,
                        usage: response?.usage,
                    };

                    runInAction(() => {
                        this.rootStore.messageStore.updateMessage(assistantMsgId, messageUpdates);
                    });
                    await this.saveUpdatesToDB(assistantMsgId, topicId, messageUpdates, []);

                    // 自动重命名主题
                    if (status === 'success') {
                        // autoRenameTopic(assistant, topicId);
                    }

                    // // 发送完成事件
                    // EventEmitter.emit(EVENT_NAMES.MESSAGE_COMPLETE, {
                    //     id: assistantMsgId,
                    //     topicId,
                    //     status,
                    // });
                },
            };

            // 7. 创建流处理器并发起请求
            const streamProcessorCallbacks = createStreamProcessor(callbacks);
            console.log('messagesForContext', messagesForContext);
            await fetchChatCompletion({
                messages: messagesForContext,
                robot: robot,
                onChunkReceived: streamProcessorCallbacks,
            });
        } catch (error: any) {
            console.error('Error fetching chat completion:', error);
            if (callbacks.onError) {
                await callbacks.onError(error);
            }
            throw error;
        } finally {
            // 重置加载状态
            runInAction(() => {
                this.rootStore.messageStore.setTopicLoading(topicId, false);
            });
        }
    }

    // 发送消息
    async sendMessage(
        userMessage: Message,
        userMessageBlocks: MessageBlock[],
        robot: Robot,
        topicId: Topic['id'],
    ) {
        try {
            if (userMessage.blocks.length === 0) {
                console.warn('sendMessage: No blocks in the provided message.');
                return;
            }

            await this.saveMessageAndBlocksToDB(userMessage, userMessageBlocks);

            runInAction(() => {
                this.rootStore.messageStore.addMessage(topicId, userMessage);
                if (userMessageBlocks.length > 0) {
                    this.rootStore.messageBlockStore.upsertManyBlocks(userMessageBlocks);
                }
            });

            const mentionedModels = userMessage.mentions;
            const queue = getTopicQueue(topicId);

            if (mentionedModels && mentionedModels.length > 0) {
                await this.dispatchMultiModelResponses(
                    topicId,
                    userMessage,
                    robot,
                    mentionedModels,
                );
            } else {
                const assistantMessage = createRobotMessage(robot.id, topicId, {
                    askId: userMessage.id,
                    model: robot.model,
                });
                await this.saveMessageAndBlocksToDB(assistantMessage, []);

                runInAction(() => {
                    this.rootStore.messageStore.addMessage(topicId, assistantMessage);
                });

                queue.add(async () => {
                    await this.fetchAndProcessAssistantResponse(topicId, robot, assistantMessage);
                });
            }
        } catch (error) {
            console.error('Error in sendMessage:', error);
        } finally {
            await this.handleChangeLoadingOfTopic(topicId);
        }
    }

    // 加载主题消息
    async loadTopicMessages(topicId: string, forceReload: boolean = false) {
        const topicMessagesExist = this.rootStore.messageStore.messageIdsByTopic.has(topicId);

        runInAction(() => {
            this.rootStore.messageStore.setCurrentTopicId(topicId);
        });

        if (topicMessagesExist && !forceReload) {
            return;
        }

        try {
            const topic = await db.topics.get(topicId);
            if (!topic) {
                await db.topics.add({ id: topicId, messages: [] });
            }

            const messagesFromDB = topic?.messages || [];

            if (messagesFromDB.length > 0) {
                const messageIds = messagesFromDB.map((m) => m.id);
                const blocks = await db.message_blocks
                    .where('messageId')
                    .anyOf(messageIds)
                    .toArray();

                runInAction(() => {
                    if (blocks && blocks.length > 0) {
                        this.rootStore.messageBlockStore.upsertManyBlocks(blocks);
                    }
                    this.rootStore.messageStore.messagesReceived(topicId, messagesFromDB);
                });
            } else {
                runInAction(() => {
                    this.rootStore.messageStore.messagesReceived(topicId, []);
                });
            }
        } catch (error: any) {
            console.error(
                `[loadTopicMessages] Failed to load messages for topic ${topicId}:`,
                error,
            );
        }
    }

    // 删除单个消息
    async deleteSingleMessage(topicId: string, messageId: string) {
        const messageToDelete = this.rootStore.messageStore.getMessageById(messageId);
        if (!messageToDelete || messageToDelete.topicId !== topicId) {
            console.error(
                `[deleteSingleMessage] Message ${messageId} not found in topic ${topicId}.`,
            );
            return;
        }

        const blockIdsToDelete = messageToDelete.blocks || [];

        try {
            runInAction(() => {
                this.rootStore.messageStore.removeMessage(topicId, messageId);
                this.rootStore.messageBlockStore.removeManyBlocks(blockIdsToDelete);
            });

            await db.message_blocks.bulkDelete(blockIdsToDelete);
            const topic = await db.topics.get(topicId);
            if (topic) {
                const finalMessages = this.rootStore.messageStore.getMessagesForTopic(topicId);
                await db.topics.update(topicId, { messages: finalMessages });
            }
        } catch (error) {
            console.error(`[deleteSingleMessage] Failed to delete message ${messageId}:`, error);
        }
    }

    // 清空主题消息
    async clearTopicMessages(topicId: string) {
        try {
            const messageIds = this.rootStore.messageStore.messageIdsByTopic.get(topicId) || [];
            const blockIdsToDeleteSet = new Set<string>();

            messageIds.forEach((messageId: string) => {
                const message = this.rootStore.messageStore.getMessageById(messageId);
                message?.blocks?.forEach((blockId: string) => blockIdsToDeleteSet.add(blockId));
            });

            const blockIdsToDelete = Array.from(blockIdsToDeleteSet);

            runInAction(() => {
                this.rootStore.messageStore.clearTopicMessages(topicId);
                if (blockIdsToDelete.length > 0) {
                    this.rootStore.messageBlockStore.removeManyBlocks(blockIdsToDelete);
                }
            });

            await db.topics.update(topicId, { messages: [] });
            if (blockIdsToDelete.length > 0) {
                await db.message_blocks.bulkDelete(blockIdsToDelete);
            }
        } catch (error) {
            console.error(
                `[clearTopicMessages] Failed to clear messages for topic ${topicId}:`,
                error,
            );
        }
    }

    // 重新生成助手响应
    async regenerateAssistantResponse(
        topicId: Topic['id'],
        assistantMessageToRegenerate: Message,
        robot: Robot,
    ) {
        try {
            const allMessages = this.rootStore.messageStore.getMessagesForTopic(topicId);
            const originalUserQuery = allMessages.find(
                (m: { id: string }) => m.id === assistantMessageToRegenerate.askId,
            );

            if (!originalUserQuery) {
                console.error(`[regenerateAssistantResponse] Original user query not found.`);
                return;
            }

            const messageToReset = this.rootStore.messageStore.getMessageById(
                assistantMessageToRegenerate.id,
            );
            if (!messageToReset) {
                console.error(`[regenerateAssistantResponse] Robot message not found.`);
                return;
            }

            const blockIdsToDelete = [...(messageToReset.blocks || [])];

            // 重置消息
            const resetAssistantMsg = resetRobotMessage(
                messageToReset,
                assistantMessageToRegenerate.modelId
                    ? {
                          status: RobotMessageStatus.PENDING,
                          updatedAt: new Date().toISOString(),
                      }
                    : {
                          status: RobotMessageStatus.PENDING,
                          updatedAt: new Date().toISOString(),
                          model: robot.model,
                      },
            );

            runInAction(() => {
                this.rootStore.messageStore.updateMessage(resetAssistantMsg.id, resetAssistantMsg);
                if (blockIdsToDelete.length > 0) {
                    this.rootStore.messageBlockStore.removeManyBlocks(blockIdsToDelete);
                }
            });

            // 更新数据库
            const finalMessages = this.rootStore.messageStore.getMessagesForTopic(topicId);
            await db.transaction('rw', db.topics, db.message_blocks, async () => {
                await db.topics.update(topicId, { messages: finalMessages });
                if (blockIdsToDelete.length > 0) {
                    await db.message_blocks.bulkDelete(blockIdsToDelete);
                }
            });

            // 添加到队列重新生成
            const queue = getTopicQueue(topicId);
            const assistantConfigForRegen = {
                ...robot,
                ...(resetAssistantMsg.model ? { model: resetAssistantMsg.model } : {}),
            };
            queue.add(async () => {
                await this.fetchAndProcessAssistantResponse(
                    topicId,
                    assistantConfigForRegen,
                    resetAssistantMsg,
                );
            });
        } catch (error) {
            console.error(`[regenerateAssistantResponse] Error:`, error);
        } finally {
            await this.handleChangeLoadingOfTopic(topicId);
        }
    }

    // 辅助方法
    private async handleChangeLoadingOfTopic(topicId: string) {
        // await waitForTopicQueue(topicId);
        runInAction(() => {
            this.rootStore.messageStore.setTopicLoading(topicId, false);
        });
    }

    private async dispatchMultiModelResponses(
        topicId: string,
        triggeringMessage: Message,
        robot: Robot,
        mentionedModels: Model[],
    ) {
        const assistantMessageStubs: Message[] = [];

        for (const mentionedModel of mentionedModels) {
            const assistantMessage = createRobotMessage(robot.id, topicId, {
                askId: triggeringMessage.id,
                model: mentionedModel,
                modelId: mentionedModel.id,
            });
            assistantMessageStubs.push(assistantMessage);
        }

        runInAction(() => {
            assistantMessageStubs.forEach((message) => {
                this.rootStore.messageStore.addMessage(topicId, message);
            });
        });

        const topicFromDB = await db.topics.get(topicId);
        if (topicFromDB) {
            const messagesToSaveInDB = this.rootStore.messageStore.getMessagesForTopic(topicId);
            await db.topics.update(topicId, { messages: messagesToSaveInDB });
        }

        const queue = getTopicQueue(topicId);
        for (const assistantMessage of assistantMessageStubs) {
            const assistantForThisMention = { ...robot, model: assistantMessage.model };
            queue.add(async () => {
                await this.fetchAndProcessAssistantResponse(
                    topicId,
                    assistantForThisMention,
                    assistantMessage,
                );
            });
        }
    }
}
