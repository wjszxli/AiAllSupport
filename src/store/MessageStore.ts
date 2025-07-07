import { RobotMessageStatus } from '@/types';
import type { Message } from '@/types/message';
import { MessageBlockStatus } from '@/types/messageBlock';
import { computed, makeAutoObservable, runInAction } from 'mobx';
import { Logger } from '@/utils/logger';

export class MessageStore {
    private logger = new Logger('MessageStore');
    // 可观察状态
    messages = new Map<string, Message>();
    messageIdsByTopic = new Map<string, string[]>();
    currentTopicId: string | null = null;
    loadingByTopic = new Map<string, boolean>();
    displayCount = 20;
    // 添加流式消息状态
    streamingMessageId: string | null = null;

    constructor() {
        makeAutoObservable(this, {
            // 明确标记计算属性
            currentTopicMessages: computed,
            allMessages: computed,
            messageEntities: computed,
        });
    }

    // Actions - 状态修改方法
    setCurrentTopicId(topicId: string | null) {
        this.currentTopicId = topicId;
        if (topicId && !this.messageIdsByTopic.has(topicId)) {
            this.messageIdsByTopic.set(topicId, []);
            this.loadingByTopic.set(topicId, false);
        }
    }

    setTopicLoading(topicId: string, loading: boolean) {
        this.loadingByTopic.set(topicId, loading);
    }

    // 设置流式消息ID
    setStreamingMessageId(messageId: string | null) {
        this.streamingMessageId = messageId;
    }

    setDisplayCount(count: number) {
        this.displayCount = count;
    }

    // 批量接收消息（用于从数据库加载）
    messagesReceived(topicId: string, messages: Message[]) {
        runInAction(() => {
            // 添加所有消息到 entities
            messages.forEach((message) => {
                this.messages.set(message.id, message);
            });

            // 设置主题的消息ID顺序
            this.messageIdsByTopic.set(
                topicId,
                messages.map((m) => m.id),
            );
            this.currentTopicId = topicId;
        });
    }

    // 添加单个消息
    addMessage(topicId: string, message: Message) {
        this.messages.set(message.id, message);

        if (!this.messageIdsByTopic.has(topicId)) {
            this.messageIdsByTopic.set(topicId, []);
        }
        this.messageIdsByTopic.get(topicId)!.push(message.id);

        if (!this.loadingByTopic.has(topicId)) {
            this.loadingByTopic.set(topicId, false);
        }
    }

    // 在指定位置插入消息
    insertMessageAtIndex(topicId: string, message: Message, index: number) {
        this.messages.set(message.id, message);

        if (!this.messageIdsByTopic.has(topicId)) {
            this.messageIdsByTopic.set(topicId, []);
        }

        const topicIds = this.messageIdsByTopic.get(topicId)!;
        const safeIndex = Math.max(0, Math.min(index, topicIds.length));
        topicIds.splice(safeIndex, 0, message.id);

        if (!this.loadingByTopic.has(topicId)) {
            this.loadingByTopic.set(topicId, false);
        }
    }

    // 更新消息
    updateMessage(
        messageId: string,
        updates: Partial<Message> & { blockInstruction?: { id: string; position?: number } },
    ) {
        const message = this.messages.get(messageId);
        if (!message) {
            this.logger.warn(`Message ${messageId} not found in entities.`);
            return;
        }

        const { blockInstruction, ...otherUpdates } = updates;

        if (blockInstruction) {
            const { id: blockIdToAdd, position } = blockInstruction;
            const currentBlocks = [...(message.blocks || [])];

            if (!currentBlocks.includes(blockIdToAdd)) {
                if (
                    typeof position === 'number' &&
                    position >= 0 &&
                    position <= currentBlocks.length
                ) {
                    currentBlocks.splice(position, 0, blockIdToAdd);
                } else {
                    currentBlocks.push(blockIdToAdd);
                }
                Object.assign(message, { ...otherUpdates, blocks: currentBlocks });
            } else if (Object.keys(otherUpdates).length > 0) {
                Object.assign(message, otherUpdates);
            }
        } else {
            Object.assign(message, otherUpdates);
        }
    }

    // 清空主题的所有消息
    clearTopicMessages(topicId: string) {
        const idsToRemove = this.messageIdsByTopic.get(topicId) || [];

        // 从 entities 中删除消息
        idsToRemove.forEach((id) => {
            this.messages.delete(id);
        });

        // 清空主题的消息ID列表
        this.messageIdsByTopic.delete(topicId);
        this.loadingByTopic.set(topicId, false);
    }

    // 删除单个消息
    removeMessage(topicId: string, messageId: string) {
        const currentTopicIds = this.messageIdsByTopic.get(topicId);
        if (currentTopicIds) {
            const filteredIds = currentTopicIds.filter((id) => id !== messageId);
            this.messageIdsByTopic.set(topicId, filteredIds);
        }
        this.messages.delete(messageId);
    }

    // 根据 askId 删除消息组
    removeMessagesByAskId(topicId: string, askId: string) {
        const currentTopicIds = this.messageIdsByTopic.get(topicId) || [];
        const idsToRemove: string[] = [];

        currentTopicIds.forEach((id) => {
            const message = this.messages.get(id);
            if (message && message.askId === askId) {
                idsToRemove.push(id);
            }
        });

        if (idsToRemove.length > 0) {
            // 从 entities 中删除
            idsToRemove.forEach((id) => {
                this.messages.delete(id);
            });

            // 从主题ID列表中删除
            const filteredIds = currentTopicIds.filter((id) => !idsToRemove.includes(id));
            this.messageIdsByTopic.set(topicId, filteredIds);
        }
    }

    // 删除多个消息
    removeMessages(topicId: string, messageIds: string[]) {
        const currentTopicIds = this.messageIdsByTopic.get(topicId);
        const idsToRemoveSet = new Set(messageIds);

        if (currentTopicIds) {
            const filteredIds = currentTopicIds.filter((id) => !idsToRemoveSet.has(id));
            this.messageIdsByTopic.set(topicId, filteredIds);
        }

        messageIds.forEach((id) => {
            this.messages.delete(id);
        });
    }

    // 更新块引用
    upsertBlockReference(messageId: string, blockId: string, status?: MessageBlockStatus) {
        const message = this.messages.get(messageId);
        if (!message) {
            this.logger.error(`Message ${messageId} not found.`);
            return;
        }

        this.logger.info(`添加块引用 ${blockId} 到消息 ${messageId}`);

        const blocks = message.blocks || [];
        if (!blocks.includes(blockId)) {
            message.blocks = [...blocks, blockId];
            this.logger.info(`块引用已添加，当前块列表:`, message.blocks);
        } else {
            this.logger.info(`块引用已存在，当前块列表:`, message.blocks);
        }

        if (status === MessageBlockStatus.ERROR) {
            message.status = RobotMessageStatus.ERROR;
        }
    }

    // 调试方法：打印消息的块引用
    debugMessageBlockReferences(messageId: string): void {
        const message = this.getMessageById(messageId);
        if (!message) {
            this.logger.debug(`消息 ${messageId} 不存在`);
            return;
        }

        this.logger.debug(`消息 ${messageId} 的块引用:`, {
            消息ID: messageId,
            块引用: message.blocks || [],
            状态: message.status,
            askId: message.askId,
        });
    }

    // Computed - 计算属性
    get allMessages(): Message[] {
        return [...this.messages.values()];
    }

    get messageEntities(): Record<string, Message> {
        const entities: Record<string, Message> = {};
        this.messages.forEach((message, id) => {
            entities[id] = message;
        });
        return entities;
    }

    get currentTopicMessages(): Message[] {
        if (!this.currentTopicId) return [];
        return this.getMessagesForTopic(this.currentTopicId);
    }

    // 获取指定主题的消息（按顺序）
    getMessagesForTopic(topicId: string): Message[] {
        console.log('getMessagesForTopic called with topicId:', topicId);
        console.log('this.messageIdsByTopic:', this.messageIdsByTopic);
        console.log('this.messages size:', this.messages.size);

        const messageIds = this.messageIdsByTopic.get(topicId) || [];
        console.log('messageIds for topic:', messageIds);

        const messages = messageIds
            .map((id) => this.messages.get(id))
            .filter((msg): msg is Message => !!msg);
        console.log('resolved messages:', messages.length);

        return messages;
    }

    // 根据ID获取消息
    getMessageById(messageId: string): Message | undefined {
        return this.messages.get(messageId);
    }

    // 获取主题加载状态
    getTopicLoading(topicId: string): boolean {
        return this.loadingByTopic.get(topicId) || false;
    }

    // 获取所有消息ID
    get allMessageIds(): string[] {
        return [...this.messages.keys()];
    }
}
