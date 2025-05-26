import { Robot, Topic } from '@/types';
import { Message } from '@/types/message';
import { MessageBlock, MessageBlockStatus, MessageBlockType } from '@/types/messageBlock';
import llmStore from '@/store/llm';
import { v4 as uuidv4 } from 'uuid';
import { createBaseMessageBlock, createMessage } from '@/utils/message/create';

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
