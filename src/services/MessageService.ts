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
    createInterruptedBlock,
    resetRobotMessage,
    createMainTextBlock,
    createThinkingBlock,
} from '@/utils/message/create';
// import { getTopicQueue, waitForTopicQueue } from '@/utils/queue';
import { getTopicQueue, waitForTopicQueue } from '@/utils/queue';
import { throttle } from 'lodash';
import { runInAction } from 'mobx';

import type { RootStore } from '@/store';
import { MessageBlock } from '@/types/messageBlock';
import { abortCompletion } from '@/utils/abortController';

export class MessageService {
    private rootStore: RootStore;
    private currentAbortController: AbortController | null = null;
    private currentTopicId: string | null = null;

    constructor(rootStore: RootStore) {
        this.rootStore = rootStore;
    }

    // 取消当前流式响应
    public cancelCurrentStream(currentTopicId: string) {
        const topicMessages = this.rootStore.messageStore.getMessagesForTopic(currentTopicId);
        console.log('[MessageService] Topic messages:', topicMessages);
        if (!topicMessages) return;

        const streamingMessages = topicMessages.filter(
            (message) =>
                message.status === RobotMessageStatus.PROCESSING ||
                message.status === RobotMessageStatus.PENDING,
        );

        console.log('[MessageService] Streaming message:', streamingMessages);

        if (!streamingMessages) return;

        const askIds = [
            ...new Set(streamingMessages?.map((m) => m.askId).filter((id) => !!id) as string[]),
        ];

        for (const askId of askIds) {
            abortCompletion(askId);
        }

        runInAction(() => {
            // this.rootStore.messageStore.setStreamingMessageId(null);
            this.rootStore.messageStore.setTopicLoading(currentTopicId, false);
        });
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

    // 新增：仅保存到数据库的节流函数，不更新store
    private throttledSaveBlockToDB = throttle((blockId: string) => {
        this.saveBlockToDB(blockId);
    }, 150);

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

                // 序列化消息对象
                const serializedMessage = JSON.parse(JSON.stringify(message));

                if (_messageIndex !== -1) {
                    updatedMessages[_messageIndex] = serializedMessage;
                } else {
                    if (messageIndex !== -1) {
                        updatedMessages.splice(messageIndex, 0, serializedMessage);
                    } else {
                        updatedMessages.push(serializedMessage);
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
        } else {
            console.warn(`[saveBlockToDB] Block ${blockId} not found in store`);
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
            await db.transaction('rw', db.topics, db.message_blocks, async () => {
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
                            const messageIndex = topic.messages.findIndex(
                                (m) => m.id === messageId,
                            );
                            if (messageIndex !== -1) {
                                Object.assign(topic.messages[messageIndex], messageUpdates);
                            }
                        });
                }
            });
        } catch (error) {
            console.error(`[saveUpdatesToDB] Failed for message ${messageId}:`);
        }
    }

    async fetchAndProcessAssistantResponse(
        topicId: string,
        robot: Robot,
        assistantMessage: Message,
    ) {
        const assistantMsgId = assistantMessage.id;
        let callbacks: StreamProcessorCallbacks = {};

        // 设置当前话题ID，用于取消时清空队列
        this.currentTopicId = topicId;

        // 创建新的 AbortController
        this.currentAbortController = new AbortController();
        const abortController = this.currentAbortController;

        console.log('[MessageService] Created new AbortController for message:', assistantMsgId);

        // 监听中止信号
        abortController.signal.addEventListener('abort', () => {
            console.log(
                '[MessageService] AbortController signal fired for message:',
                assistantMsgId,
            );
        });

        try {
            // 1. 设置加载状态
            runInAction(() => {
                this.rootStore.messageStore.setTopicLoading(topicId, true);
            });

            // 2. 核心状态变量
            let currentBlockId: string | null = null;
            let currentBlockType: MessageBlockType | null = null;
            let accumulatedContent = '';
            let accumulatedThinkingContent = '';
            let isThinkingComplete = false; // 添加标志防止思考完成后继续处理thinking chunks

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

                if (currentBlockType !== MessageBlockType.MAIN_TEXT) {
                    accumulatedContent = '';
                }

                if (currentBlockType !== MessageBlockType.THINKING) {
                    accumulatedThinkingContent = '';
                }

                // MobX 状态更新
                runInAction(() => {
                    this.rootStore.messageStore.updateMessage(assistantMsgId, {
                        blockInstruction: { id: newBlock.id },
                    });
                    this.rootStore.messageBlockStore.upsertBlock(newBlock);
                    this.rootStore.messageStore.upsertBlockReference(
                        assistantMsgId,
                        newBlock.id,
                        newBlock.status,
                    );
                });

                // 保存到数据库
                const updatedMessage = this.rootStore.messageStore.getMessageById(assistantMsgId);
                if (updatedMessage) {
                    await this.saveUpdatesToDB(
                        assistantMsgId,
                        topicId,
                        { blocks: updatedMessage.blocks },
                        [newBlock],
                    );
                } else {
                    console.warn(
                        `[handleBlockTransition] Message ${assistantMsgId} not found in store`,
                    );
                }
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

                // 总是保存到数据库，不仅仅是 SUCCESS 状态
                await this.saveBlockToDB(currentBlockId);
            };

            // 6. 核心回调函数
            callbacks = {
                // 开始响应
                onLLMResponseCreated: () => {
                    runInAction(() => {
                        this.rootStore.messageStore.setStreamingMessageId(assistantMsgId);
                    });

                    // 调试信息：只在开发环境下输出
                    if (process.env.NODE_ENV === 'development') {
                        console.log('[onLLMResponseCreated] Setting streamingMessageId:', {
                            assistantMsgId,
                            streamingMessageId: this.rootStore.messageStore.streamingMessageId,
                        });
                    }

                    const baseBlock = createBaseMessageBlock(
                        assistantMsgId,
                        MessageBlockType.UNKNOWN,
                        {
                            status: MessageBlockStatus.PROCESSING,
                        },
                    );
                    handleBlockTransition(baseBlock, MessageBlockType.UNKNOWN);
                },

                // 思考内容流处理
                onThinkingChunk: (text: string, thinking_millsec?: number) => {
                    // 如果思考已完成，跳过后续的思考块处理
                    if (isThinkingComplete) {
                        return;
                    }

                    accumulatedThinkingContent += text;

                    if (currentBlockId) {
                        if (currentBlockType === MessageBlockType.UNKNOWN) {
                            runInAction(() => {
                                this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                    type: MessageBlockType.THINKING,
                                    content: accumulatedThinkingContent,
                                    status: MessageBlockStatus.STREAMING,
                                    thinking_millsec: thinking_millsec,
                                });
                            });
                            currentBlockType = MessageBlockType.THINKING;

                            const newBlock = createThinkingBlock(
                                assistantMsgId,
                                accumulatedThinkingContent,
                                {
                                    status: MessageBlockStatus.STREAMING,
                                    thinking_millsec: thinking_millsec,
                                },
                            );

                            this.saveUpdatesToDB(
                                assistantMsgId,
                                topicId,
                                {
                                    blocks: [],
                                },
                                [newBlock],
                            );
                        } else if (currentBlockType === MessageBlockType.THINKING) {
                            runInAction(() => {
                                this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                    content: accumulatedThinkingContent,
                                    status: MessageBlockStatus.STREAMING,
                                    thinking_millsec: thinking_millsec,
                                });
                            });
                            this.throttledSaveBlockToDB(currentBlockId);
                        } else {
                            const newBlock = createThinkingBlock(
                                assistantMsgId,
                                accumulatedThinkingContent,
                                {
                                    status: MessageBlockStatus.STREAMING,
                                    thinking_millsec: thinking_millsec,
                                },
                            );
                            handleBlockTransition(newBlock, MessageBlockType.THINKING);
                        }
                    }
                },

                // 思考完成
                onThinkingComplete: async (finalText: string, thinking_millsec?: number) => {
                    this.cancelThrottledBlockUpdate();

                    // 设置思考完成标志，防止后续的thinking chunk覆盖状态
                    isThinkingComplete = true;

                    if (currentBlockType === MessageBlockType.THINKING && currentBlockId) {
                        runInAction(() => {
                            this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                type: MessageBlockType.THINKING,
                                content: finalText,
                                status: MessageBlockStatus.SUCCESS,
                                thinking_millsec: thinking_millsec,
                            });
                        });

                        // 确保保存到数据库
                        await this.saveBlockToDB(currentBlockId);
                    } else {
                        console.warn(
                            `[onThinkingComplete] Received thinking.complete but last block was not THINKING (was ${currentBlockType}) or lastBlockId is null.`,
                        );
                    }
                },

                // 文本流处理
                onTextChunk: (text: string) => {
                    accumulatedContent += text;
                    if (currentBlockId) {
                        // 如果当前块是思考块，需要先完成它
                        if (currentBlockType === MessageBlockType.UNKNOWN) {
                            runInAction(() => {
                                this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                    type: MessageBlockType.MAIN_TEXT,
                                    content: accumulatedContent,
                                    status: MessageBlockStatus.STREAMING,
                                });
                            });
                            currentBlockType = MessageBlockType.MAIN_TEXT;
                            this.throttledSaveBlockToDB(currentBlockId);
                        } else if (currentBlockType === MessageBlockType.MAIN_TEXT) {
                            runInAction(() => {
                                this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                    content: accumulatedContent,
                                    status: MessageBlockStatus.STREAMING,
                                });
                            });
                            this.throttledSaveBlockToDB(currentBlockId);
                        } else {
                            const newBlock = createMainTextBlock(
                                assistantMsgId,
                                accumulatedContent,
                                {
                                    status: MessageBlockStatus.STREAMING,
                                },
                            );
                            handleBlockTransition(newBlock, MessageBlockType.MAIN_TEXT);
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
                onError: async (error: {
                    name: string;
                    message: string;
                    stack: any;
                    status?: number;
                    code?: number;
                }) => {
                    this.cancelThrottledBlockUpdate();
                    runInAction(() => {
                        this.rootStore.messageStore.setStreamingMessageId(null);
                    });
                    const isAbort = isAbortError(error);
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

                    if (isAbort) {
                        // 用户主动取消，创建中断状态块
                        let interruptedContent: string | undefined;

                        if (currentBlockId && currentBlockType === MessageBlockType.MAIN_TEXT) {
                            // 如果当前有正在处理的主文本块，获取已有内容
                            const currentBlock =
                                this.rootStore.messageBlockStore.getBlockById(currentBlockId);
                            if (currentBlock && 'content' in currentBlock) {
                                interruptedContent = currentBlock.content || undefined;
                            }
                        }

                        // 创建中断状态块
                        const interruptedBlock = createInterruptedBlock(
                            assistantMsgId,
                            interruptedContent,
                            {
                                status: MessageBlockStatus.SUCCESS,
                                // 添加一个高优先级标记，确保刷新后能正确识别这是中断块
                                // isInterrupted: true,
                            },
                        );

                        // 先保存新的中断块到BlockStore
                        runInAction(() => {
                            this.rootStore.messageBlockStore.upsertBlock(interruptedBlock);
                        });

                        // 先同步将块保存到数据库
                        await db.message_blocks.put(JSON.parse(JSON.stringify(interruptedBlock)));

                        // 然后添加到消息的blocks引用中
                        await handleBlockTransition(interruptedBlock, MessageBlockType.INTERRUPTED);

                        // 同步更新消息状态到数据库，确保刷新后能恢复
                        const updatedMessage =
                            this.rootStore.messageStore.getMessageById(assistantMsgId);
                        if (updatedMessage) {
                            await db.transaction('rw', db.topics, async () => {
                                await db.topics
                                    .where('id')
                                    .equals(topicId)
                                    .modify((topic) => {
                                        if (!topic) return;
                                        const messageIndex = topic.messages.findIndex(
                                            (m) => m.id === assistantMsgId,
                                        );
                                        if (messageIndex !== -1) {
                                            // 深度克隆确保所有属性都被正确序列化
                                            const deepClonedMessage = JSON.parse(
                                                JSON.stringify(updatedMessage),
                                            );
                                            topic.messages[messageIndex] = deepClonedMessage;
                                        }
                                    });
                            });
                        }
                    } else {
                        // 真正的错误，创建错误块
                        const errorBlock = createErrorBlock(
                            assistantMsgId,
                            {
                                name: error.name,
                                message: error.message || 'Stream processing error',
                                stack: error.stack,
                                status: error.status || error.code,
                            },
                            { status: MessageBlockStatus.SUCCESS },
                        );
                        debugger;
                        await handleBlockTransition(errorBlock, MessageBlockType.ERROR);
                    }

                    const messageUpdate = {
                        status: isAbort ? RobotMessageStatus.SUCCESS : RobotMessageStatus.ERROR,
                    };
                    runInAction(() => {
                        this.rootStore.messageStore.updateMessage(assistantMsgId, messageUpdate);
                    });
                    await this.saveUpdatesToDB(assistantMsgId, topicId, messageUpdate, []);
                },

                // 完成处理
                onComplete: async (status: RobotMessageStatus, response?: any) => {
                    this.cancelThrottledBlockUpdate();
                    runInAction(() => {
                        this.rootStore.messageStore.setStreamingMessageId(null);
                    });
                    if (currentBlockId && status === 'success') {
                        const currentBlock =
                            this.rootStore.messageBlockStore.getBlockById(currentBlockId);
                        if (currentBlock && currentBlock.status !== MessageBlockStatus.SUCCESS) {
                            runInAction(() => {
                                this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                    status: MessageBlockStatus.SUCCESS,
                                });
                            });
                            await this.saveBlockToDB(currentBlockId);
                        }
                    }
                    const messageUpdates: Partial<Message> = {
                        status,
                        metrics: response?.metrics,
                        usage: response?.usage,
                    };
                    runInAction(() => {
                        this.rootStore.messageStore.updateMessage(assistantMsgId, messageUpdates);
                    });
                    await this.saveUpdatesToDB(assistantMsgId, topicId, messageUpdates, []);
                    if (status === 'success') {
                        // autoRenameTopic(assistant, topicId);
                    }
                },
            };

            // 7. 创建流处理器并发起请求
            const streamProcessorCallbacks = createStreamProcessor(callbacks);
            await fetchChatCompletion({
                messages: messagesForContext,
                robot: robot,
                onChunkReceived: streamProcessorCallbacks,
                abortController,
            });
        } catch (error: any) {
            console.error('Error fetching chat completion:', error);
            if (callbacks.onError) {
                await callbacks.onError(error);
            }
            // // 只有在非用户主动取消的情况下才抛出错误
            // const isAbort = isAbortError(error);
            // if (!isAbort) {
            // throw error;
            // }
        } finally {
            // Clean up any remaining blocks in PROCESSING/STREAMING state
            // 但要小心不要覆盖已经正确完成的思考块
            // const message = this.rootStore.messageStore.getMessageById(assistantMsgId);
            // if (message && message.blocks) {
            //     const blocksToCleanup: string[] = [];
            //     message.blocks.forEach((blockId: string) => {
            //         const block = this.rootStore.messageBlockStore.getBlockById(blockId);
            //         if (
            //             block &&
            //             (block.status === MessageBlockStatus.PROCESSING ||
            //                 block.status === MessageBlockStatus.STREAMING)
            //         ) {
            //             // 只清理确实还在处理中的块
            //             console.log('[finally cleanup] Found block to cleanup:', {
            //                 blockId,
            //                 type: block.type,
            //                 status: block.status,
            //             });
            //             blocksToCleanup.push(blockId);
            //         }
            //     });
            //     if (blocksToCleanup.length > 0) {
            //         console.log('[finally cleanup] Cleaning up blocks:', blocksToCleanup);
            //         runInAction(() => {
            //             blocksToCleanup.forEach((blockId) => {
            //                 this.rootStore.messageBlockStore.updateBlock(blockId, {
            //                     status: MessageBlockStatus.SUCCESS,
            //                 });
            //             });
            //         });
            //         // Save the cleaned up blocks to database
            //         for (const blockId of blocksToCleanup) {
            //             await this.saveBlockToDB(blockId);
            //         }
            //     }
            // }
            // runInAction(() => {
            //     this.rootStore.messageStore.setTopicLoading(topicId, false);
            //     this.rootStore.messageStore.setStreamingMessageId(null);
            // });
            // // 清理 AbortController
            // if (this.currentAbortController === abortController) {
            //     this.currentAbortController = null;
            // }
            // // 清理当前话题ID
            // if (this.currentTopicId === topicId) {
            //     this.currentTopicId = null;
            // }
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

                const blocksByMessageId = new Map<string, string[]>();
                blocks.forEach((block) => {
                    if (!blocksByMessageId.has(block.messageId)) {
                        blocksByMessageId.set(block.messageId, []);
                    }
                    blocksByMessageId.get(block.messageId)!.push(block.id);
                });

                const correctedMessages = messagesFromDB.map((message) => {
                    const messageBlocks = blocksByMessageId.get(message.id) || [];
                    return {
                        ...message,
                        blocks: messageBlocks,
                    };
                });

                runInAction(() => {
                    if (blocks && blocks.length > 0) {
                        // Clean up any stale PROCESSING/STREAMING blocks from previous sessions
                        // 但要避免清理当前正在流式处理的块
                        const currentStreamingMessageId =
                            this.rootStore.messageStore.streamingMessageId;

                        const cleanedBlocks = blocks.map((block) => {
                            // 如果当前有正在流式的消息，且这个块属于该消息，则保持其原状态
                            if (
                                currentStreamingMessageId &&
                                block.messageId === currentStreamingMessageId
                            ) {
                                return block;
                            }

                            // 否则清理过期的流式块
                            if (
                                block.status === MessageBlockStatus.PROCESSING ||
                                block.status === MessageBlockStatus.STREAMING
                            ) {
                                return {
                                    ...block,
                                    status: MessageBlockStatus.SUCCESS,
                                };
                            }
                            return block;
                        });

                        this.rootStore.messageBlockStore.upsertManyBlocks(cleanedBlocks);

                        // Update database with cleaned blocks if any were modified
                        const modifiedBlocks = cleanedBlocks.filter(
                            (cleanedBlock, index) => cleanedBlock.status !== blocks[index].status,
                        );
                        if (modifiedBlocks.length > 0) {
                            // Save modified blocks to database asynchronously
                            Promise.all(
                                modifiedBlocks.map((block) =>
                                    db.message_blocks.put(JSON.parse(JSON.stringify(block))),
                                ),
                            ).catch((error) => {
                                console.error(
                                    '[loadTopicMessages] Failed to save cleaned blocks:',
                                    error,
                                );
                            });
                        }
                    }
                    this.rootStore.messageStore.messagesReceived(topicId, correctedMessages);
                });
            } else {
                console.log(`[loadTopicMessages] No messages found for topic ${topicId}`);
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
            const resetAssistantMsg = resetRobotMessage(messageToReset, {
                status: RobotMessageStatus.PENDING,
                updatedAt: new Date().toISOString(),
                ...(assistantMessageToRegenerate.modelId ? {} : { model: robot.model }),
            });

            runInAction(() => {
                this.rootStore.messageStore.updateMessage(resetAssistantMsg.id, resetAssistantMsg);
                if (blockIdsToDelete.length > 0) {
                    this.rootStore.messageBlockStore.removeManyBlocks(blockIdsToDelete);
                }
            });

            // 更新数据库 - 使用深度序列化确保对象完全可序列化
            const finalMessages = this.rootStore.messageStore.getMessagesForTopic(topicId);

            // 使用 JSON.parse(JSON.stringify()) 进行深度清理，移除所有不可序列化的属性
            const deepCleanedMessages = JSON.parse(JSON.stringify(finalMessages));

            await db.transaction('rw', db.topics, db.message_blocks, async () => {
                await db.topics.update(topicId, { messages: deepCleanedMessages });
                if (blockIdsToDelete.length > 0) {
                    await db.message_blocks.bulkDelete(blockIdsToDelete);
                }
            });

            // 添加到队列重新生成 - 创建完全可序列化的robot配置
            const queue = getTopicQueue(topicId);

            // 深度清理robot对象，移除所有可能的循环引用和不可序列化属性
            const cleanRobot = JSON.parse(
                JSON.stringify({
                    id: robot.id,
                    name: robot.name,
                    prompt: robot.prompt,
                    type: robot.type,
                    ...(robot.icon && { icon: robot.icon }),
                    ...(robot.description && { description: robot.description }),
                    // 提供空的topics数组以满足Robot类型要求
                    topics: [],
                    ...(robot.selectedTopicId && { selectedTopicId: robot.selectedTopicId }),
                    // 只包含当前需要的model信息
                    ...(resetAssistantMsg.model && {
                        model: {
                            id: resetAssistantMsg.model.id,
                            provider: resetAssistantMsg.model.provider,
                            name: resetAssistantMsg.model.name,
                            group: resetAssistantMsg.model.group,
                        },
                    }),
                }),
            );

            // 也要深度清理resetAssistantMsg
            const cleanResetMessage = JSON.parse(JSON.stringify(resetAssistantMsg));

            queue.add(async () => {
                await this.fetchAndProcessAssistantResponse(topicId, cleanRobot, cleanResetMessage);
            });
        } catch (error) {
            console.error(`[regenerateAssistantResponse] Error:`, error);
        } finally {
            await this.handleChangeLoadingOfTopic(topicId);
        }
    }

    // 辅助方法
    private async handleChangeLoadingOfTopic(topicId: string) {
        await waitForTopicQueue(topicId);
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
            // 使用深度序列化确保对象完全可序列化
            const deepCleanedMessages = JSON.parse(JSON.stringify(messagesToSaveInDB));
            await db.topics.update(topicId, { messages: deepCleanedMessages });
        }

        const queue = getTopicQueue(topicId);
        for (const assistantMessage of assistantMessageStubs) {
            // 创建清理的robot对象以避免序列化问题
            const cleanRobotForMention = JSON.parse(
                JSON.stringify({
                    id: robot.id,
                    name: robot.name,
                    prompt: robot.prompt,
                    type: robot.type,
                    ...(robot.icon && { icon: robot.icon }),
                    ...(robot.description && { description: robot.description }),
                    topics: [],
                    ...(robot.selectedTopicId && { selectedTopicId: robot.selectedTopicId }),
                    ...(assistantMessage.model && {
                        model: {
                            id: assistantMessage.model.id,
                            provider: assistantMessage.model.provider,
                            name: assistantMessage.model.name,
                            group: assistantMessage.model.group,
                        },
                    }),
                }),
            );

            // 清理assistant消息对象
            const cleanAssistantMessage = JSON.parse(JSON.stringify(assistantMessage));

            queue.add(async () => {
                await this.fetchAndProcessAssistantResponse(
                    topicId,
                    cleanRobotForMention,
                    cleanAssistantMessage,
                );
            });
        }
    }
}

// 创建单例实例
let messageService: MessageService | null = null;

export const getMessageService = (rootStore: RootStore): MessageService => {
    if (!messageService) {
        messageService = new MessageService(rootStore);
    }
    return messageService;
};

export default getMessageService;
