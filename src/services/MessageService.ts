import { Model, Robot, RobotMessageStatus, Topic } from '@/types';
import { Message } from '@/types/message';
import { MessageBlock, MessageBlockStatus, MessageBlockType } from '@/types/messageBlock';
import llmStore from '@/store/llm';
import { v4 as uuidv4 } from 'uuid';
import { createBaseMessageBlock, createMessage } from '@/utils/message/create';
import rootStore from '@/store';

export function getUserMessage({
    robot,
    topic,
    type,
    content,
}: {
    robot: Robot;
    topic: Topic;
    type?: Message['type'];
    content?: string;
}): { message: Message; blocks: MessageBlock[] } {
    const defaultModel = llmStore.defaultModel;
    const model = robot.model || defaultModel;
    const messageId = uuidv4();
    const blocks: MessageBlock[] = [];
    const blockIds: string[] = [];

    if (content?.trim()) {
        const baseBlock = createBaseMessageBlock(messageId, MessageBlockType.MAIN_TEXT, {
            status: MessageBlockStatus.SUCCESS,
        });
        const textBlock = {
            ...baseBlock,
            content,
        };

        blocks.push(textBlock);
        blockIds.push(textBlock.id);
    }

    // 直接在createMessage中传入id
    const message = createMessage('user', topic.id, robot.id, {
        id: messageId,
        modelId: model?.id,
        model: model,
        blocks: blockIds,
        type,
    });

    return { message, blocks };
}

export function resetRobotMessage(message: Message, model?: Model): Message {
    const blockIdsToRemove = message.blocks;
    if (blockIdsToRemove.length > 0) {
        rootStore.messageBlockStore.removeManyBlocks(blockIdsToRemove);
    }

    return {
        ...message,
        model: model || message.model,
        modelId: model?.id || message.modelId,
        status: RobotMessageStatus.PENDING,
        useful: undefined,
        askId: undefined,
        blocks: [],
        createdAt: new Date().toISOString(),
    };
}

export function getGroupedMessages(messages: Message[]): {
    [key: string]: (Message & { index: number })[];
} {
    const groups: { [key: string]: (Message & { index: number })[] } = {};
    messages.forEach((message, index) => {
        // Use askId if available (should be on assistant messages), otherwise group user messages individually
        const key =
            message.role === 'assistant' && message.askId
                ? 'assistant' + message.askId
                : message.role + message.id;
        if (key && !groups[key]) {
            groups[key] = [];
        }
        groups[key].push({ ...message, index }); // Add message with its original index
        // Sort by index within group to maintain original order (ascending)
        groups[key].sort((a, b) => a.index - b.index);
    });
    return groups;
}
