import { Message } from '@/types/message';
import { MainTextMessageBlock } from '@/types/messageBlock';

/**
 * 找出消息中的所有主文本块，不依赖 Redux
 * @param message - 消息对象
 * @returns 主文本块数组
 */
export const findMainTextBlocks = (message: Message): MainTextMessageBlock[] => {
    // 检查消息是否有效并包含块
    if (!message || !message.blocks || message.blocks.length === 0) {
        return [];
    }

    const textBlocks: MainTextMessageBlock[] = [];

    // Iterate through message blocks
    for (const blockId of message.blocks) {
        // Get block from store since blocks array contains IDs
        const block = blockId as unknown as MainTextMessageBlock;
        // if (block.type === MessageBlockType.MAIN_TEXT) {
        textBlocks.push(block);
        // }
    }

    return textBlocks;
};

export const getMainTextContent = (message: Message): string => {
    const textBlocks = findMainTextBlocks(message);
    return textBlocks.map((block) => block.content || block).join('\n\n');
};
