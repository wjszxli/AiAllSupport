import React from 'react';
import type { ChatMessage } from '@/typings';
import { flushSync } from 'react-dom';

/**
 * 更新消息列表中的特定消息
 * @param setMessages React 状态更新函数
 * @param messageId 需要更新的消息 ID
 * @param newMessage 新的消息对象
 */
export function updateMessage(
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    messageId: number,
    newMessage: ChatMessage,
): void {
    // 使用 flushSync 确保每次更新后立即刷新 DOM
    flushSync(() => {
        setMessages((prev) => {
            const existingMessage = prev.find((msg) => msg.id === messageId);
            if (existingMessage) {
                return prev.map((msg) => (msg.id === messageId ? newMessage : msg));
            }
            return [...prev, newMessage];
        });
    });
}

/**
 * 创建一个系统消息对象
 * @param messageText 消息文本
 * @returns 新的系统消息对象
 */
export function createSystemMessage(messageText: string): ChatMessage {
    return {
        id: Date.now(),
        text: messageText,
        sender: 'system',
    };
}
