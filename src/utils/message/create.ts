import { Message } from '@/types/message';
import { AssistantMessageStatus, UserMessageStatus } from '@/types';

/**
 * 生成一个简单的ID
 * @returns 随机ID
 */
function generateId(): string {
    return (
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
}

/**
 * 创建一个新的消息对象
 * @param content 消息内容
 * @param role 消息角色 (user/assistant/system)
 * @param options 可选参数
 * @returns 完整的消息对象
 */
export function createMessage(
    content: string,
    role: 'user' | 'assistant' | 'system' = 'user',
    options: {
        assistantId?: string;
        topicId?: string;
        modelId?: string;
        isPreset?: boolean;
    } = {},
): Message {
    const now = new Date().toISOString();
    const status =
        role === 'assistant' ? AssistantMessageStatus.PROCESSING : UserMessageStatus.SUCCESS;

    return {
        id: generateId(),
        role,
        assistantId: options.assistantId || 'default',
        topicId: options.topicId || 'default',
        createdAt: now,
        updatedAt: now,
        status,
        modelId: options.modelId,
        isPreset: options.isPreset || false,
        blocks: [content], // 简单起见，直接将内容作为一个块ID
    };
}

/**
 * 将简单的 {role, content} 格式转换为完整的 Message 对象
 * @param simpleMessage 简单格式的消息
 * @param options 可选参数
 * @returns 完整的消息对象
 */
export function convertSimpleMessage(
    simpleMessage: { role: 'user' | 'assistant' | 'system'; content: string },
    options: {
        assistantId?: string;
        topicId?: string;
        modelId?: string;
    } = {},
): Message {
    return createMessage(simpleMessage.content, simpleMessage.role, options);
}
