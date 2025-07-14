import { Robot, RobotMessageStatus, Topic, UserMessageStatus } from '@/types';
import { Message } from '@/types/message';
import {
    BaseMessageBlock,
    ErrorMessageBlock,
    InterruptedMessageBlock,
    MainTextMessageBlock,
    MessageBlockStatus,
    MessageBlockType,
    ThinkingMessageBlock,
    SearchResultsMessageBlock,
    SearchStatusMessageBlock,
} from '@/types/messageBlock';
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

export function createRobotMessage(
    assistantId: Robot['id'],
    topicId: Topic['id'],
    overrides: Partial<
        Omit<Message, 'id' | 'role' | 'assistantId' | 'topicId' | 'createdAt' | 'type' | 'status'>
    > = {},
): Message {
    const now = new Date().toISOString();
    const messageId = uuidv4();

    return {
        id: messageId,
        role: 'assistant',
        assistantId: assistantId,
        topicId,
        createdAt: now,
        status: RobotMessageStatus.PENDING,
        blocks: [],
        ...overrides,
    };
}

export function createErrorBlock(
    messageId: string,
    errorData: Record<string, any>,
    overrides: Partial<Omit<ErrorMessageBlock, 'id' | 'messageId' | 'type' | 'error'>> = {},
): ErrorMessageBlock {
    const baseBlock = createBaseMessageBlock(messageId, MessageBlockType.ERROR, {
        status: MessageBlockStatus.ERROR,
        error: errorData,
        ...overrides,
    });
    return baseBlock as ErrorMessageBlock;
}

export function createInterruptedBlock(
    messageId: string,
    content?: string,
    overrides: Partial<Omit<InterruptedMessageBlock, 'id' | 'messageId' | 'type' | 'content'>> = {},
): InterruptedMessageBlock {
    const baseBlock = createBaseMessageBlock(messageId, MessageBlockType.INTERRUPTED, {
        status: MessageBlockStatus.SUCCESS,
        ...overrides,
    });
    return {
        ...baseBlock,
        content,
    } as InterruptedMessageBlock;
}

export const resetRobotMessage = (
    originalMessage: Message,
    updates?: Partial<Pick<Message, 'status' | 'updatedAt' | 'model' | 'modelId'>>, // Primarily allow updating status
): Message => {
    // Ensure we are only resetting assistant messages
    if (originalMessage.role !== 'assistant') {
        console.warn(
            `[resetAssistantMessage] Attempted to reset a non-assistant message (ID: ${originalMessage.id}, Role: ${originalMessage.role}). Returning original.`,
        );
        return originalMessage;
    }

    // Create the base reset message
    return {
        // --- Retain Core Identifiers ---
        id: originalMessage.id, // Keep the same message ID
        topicId: originalMessage.topicId,
        askId: originalMessage.askId, // Keep the link to the original user query

        // --- Retain Identity ---
        role: 'assistant',
        assistantId: originalMessage.assistantId,
        model: originalMessage.model, // Keep the model information
        modelId: originalMessage.modelId,

        // --- Reset Response Content & Status ---
        blocks: [], // <<< CRITICAL: Clear the blocks array
        mentions: undefined, // Clear any mentions
        status: RobotMessageStatus.PENDING, // Default to PENDING
        metrics: undefined, // Clear performance metrics
        usage: undefined, // Clear token usage data

        // --- Timestamps ---
        createdAt: originalMessage.createdAt, // Keep original creation timestamp

        // --- Apply Overrides ---
        ...updates, // Apply any specific updates passed in (e.g., a different status)
    };
};

export function createMainTextBlock(
    messageId: string,
    content: string,
    overrides: Partial<Omit<MainTextMessageBlock, 'id' | 'messageId' | 'type' | 'content'>> = {},
): MainTextMessageBlock {
    const baseBlock = createBaseMessageBlock(messageId, MessageBlockType.MAIN_TEXT, overrides);
    return {
        ...baseBlock,
        content,
        knowledgeBaseIds: overrides.knowledgeBaseIds,
    };
}

export function createThinkingBlock(
    messageId: string,
    content: string = '',
    overrides: Partial<Omit<ThinkingMessageBlock, 'id' | 'messageId' | 'type' | 'content'>> = {},
): ThinkingMessageBlock {
    const baseOverrides: Partial<Omit<BaseMessageBlock, 'id' | 'messageId' | 'type'>> = {
        status: MessageBlockStatus.PROCESSING,
        ...overrides,
    };
    const baseBlock = createBaseMessageBlock(messageId, MessageBlockType.THINKING, baseOverrides);
    return {
        ...baseBlock,
        content,
        thinking_millsec: overrides.thinking_millsec,
    };
}

export function createSearchStatusBlock(
    messageId: string,
    query: string,
    engine?: string,
    options: {
        status?: MessageBlockStatus;
    } = {},
): SearchStatusMessageBlock {
    const { status = MessageBlockStatus.STREAMING } = options;

    return {
        id: uuidv4(),
        messageId,
        type: MessageBlockType.SEARCH_STATUS,
        query,
        engine,
        status,
        createdAt: new Date().toISOString(),
    };
}

export function createSearchResultsBlock(
    messageId: string,
    query: string,
    results: Array<{
        title: string;
        url: string;
        snippet: string;
        domain: string;
    }>,
    engine: string,
    options: {
        status?: MessageBlockStatus;
        contentFetched?: boolean;
    } = {},
): SearchResultsMessageBlock {
    const { status = MessageBlockStatus.SUCCESS, contentFetched = false } = options;

    return {
        id: uuidv4(),
        messageId,
        type: MessageBlockType.SEARCH_RESULTS,
        query,
        results,
        engine,
        contentFetched,
        status,
        createdAt: new Date().toISOString(),
    };
}
