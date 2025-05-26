import { RobotMessageStatus, UserMessageStatus } from '@/types';
import { Message } from '@/types/message';
import { BaseMessageBlock, MessageBlockStatus, MessageBlockType } from '@/types/messageBlock';
import { v4 as uuidv4 } from 'uuid';

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export function createBaseMessageBlock<T extends MessageBlockType>(
    messageId: string,
    type: T,
    overrides: Partial<Omit<BaseMessageBlock, 'id' | 'messageId' | 'type'>> = {},
): BaseMessageBlock & { type: T } {
    const now = new Date().toISOString();
    return {
        id: uuidv4(),
        messageId,
        type,
        createdAt: now,
        status: MessageBlockStatus.PROCESSING,
        error: undefined,
        ...overrides,
    };
}

export function createMessage(
    role: 'user' | 'assistant' | 'system',
    topicId: string,
    assistantId: string,
    overrides: PartialBy<
        Omit<Message, 'role' | 'topicId' | 'assistantId' | 'createdAt' | 'status'>,
        'blocks' | 'id'
    > = {},
): Message {
    const now = new Date().toISOString();
    const messageId = overrides.id || uuidv4();

    const { blocks: initialBlocks, id, ...restOverrides } = overrides;

    let blocks: string[] = initialBlocks || [];

    if (role !== 'system' && (!initialBlocks || initialBlocks.length === 0)) {
        console.warn(
            'createMessage: initialContent provided but no initialBlocks. Block must be created separately.',
        );
    }

    blocks = blocks.map(String);

    return {
        id: id ?? messageId,
        role,
        topicId,
        assistantId,
        createdAt: now,
        status: role === 'user' ? UserMessageStatus.SUCCESS : RobotMessageStatus.PENDING,
        blocks,
        ...restOverrides,
    };
}
