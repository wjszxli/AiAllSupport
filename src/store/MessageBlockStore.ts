import type { MessageBlock } from '@/types/messageBlock';
import { computed, makeAutoObservable } from 'mobx';
import { Logger } from '@/utils/logger';

export class MessageBlockStore {
    private logger = new Logger('MessageBlockStore');
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
        console.log('upsertBlock', block);
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

    // 调试方法：打印指定消息的所有块
    debugMessageBlocks(messageId: string): void {
        const blocks = this.getBlocksForMessage(messageId);
        this.logger.debug(`消息 ${messageId} 的块:`, {
            数量: blocks.length,
            块列表: blocks.map((block) => ({
                id: block.id,
                type: block.type,
                status: block.status,
                content:
                    'content' in block
                        ? block.content?.substring(0, 50) +
                          (block.content && block.content.length > 50 ? '...' : '')
                        : '(无内容)',
            })),
        });
    }

    // 调试方法：打印所有块的统计信息
    debugAllBlocks(): void {
        const allBlocks = this.allBlocks;
        const blocksByType = new Map<string, number>();

        allBlocks.forEach((block) => {
            const type = block.type;
            blocksByType.set(type, (blocksByType.get(type) || 0) + 1);
        });

        this.logger.debug('所有块的统计信息:', {
            总数: allBlocks.length,
            类型统计: Object.fromEntries(blocksByType.entries()),
            消息数: this.blocksByMessage.size,
        });
    }
}
