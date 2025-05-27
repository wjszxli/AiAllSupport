import type { MessageBlock } from '@/types/messageBlock';
import { computed, makeAutoObservable } from 'mobx';

export class MessageBlockStore {
    // 可观察状态
    blocks = new Map<string, MessageBlock>();

    constructor() {
        makeAutoObservable(this, {
            // 明确标记计算属性
            allBlocks: computed,
            blocksByMessage: computed,
        });
    }

    // Actions - 状态修改方法
    upsertBlock(block: MessageBlock) {
        this.blocks.set(block.id, block);
    }

    upsertManyBlocks(blocks: MessageBlock[]) {
        blocks.forEach((block) => {
            this.blocks.set(block.id, block);
        });
    }

    updateBlock(id: string, changes: Partial<MessageBlock>) {
        const block = this.blocks.get(id);
        if (block) {
            Object.assign(block, changes);
        }
    }

    removeBlock(id: string) {
        this.blocks.delete(id);
    }

    removeManyBlocks(ids: string[]) {
        ids.forEach((id) => {
            this.blocks.delete(id);
        });
    }

    // Computed - 计算属性
    get allBlocks(): MessageBlock[] {
        return Array.from(this.blocks.values());
    }

    get blocksByMessage(): Map<string, MessageBlock[]> {
        const result = new Map<string, MessageBlock[]>();
        this.blocks.forEach((block) => {
            const messageId = block.messageId;
            if (!result.has(messageId)) {
                result.set(messageId, []);
            }
            result.get(messageId)!.push(block);
        });
        return result;
    }

    // 获取指定消息的所有块
    getBlocksForMessage(messageId: string): MessageBlock[] {
        return this.blocksByMessage.get(messageId) || [];
    }

    // 根据ID获取块
    getBlockById(blockId: string): MessageBlock | undefined {
        return this.blocks.get(blockId);
    }

    // 获取所有块ID
    get allBlockIds(): string[] {
        return Array.from(this.blocks.keys());
    }

    // 获取块实体字典
    get blockEntities(): Record<string, MessageBlock> {
        const entities: Record<string, MessageBlock> = {};
        this.blocks.forEach((block, id) => {
            entities[id] = block;
        });
        return entities;
    }
}
