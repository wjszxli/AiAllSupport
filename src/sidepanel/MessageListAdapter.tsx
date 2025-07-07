import React from 'react';
import MessageList from '@/chat/components/MessageList';
import { UserMessageStatus, RobotMessageStatus } from '@/types';
import type { ChatMessage  } from '@/types';
import type { Message } from '@/types/message';

interface MessageListAdapterProps {
    messages: ChatMessage[];
    selectedProvider: string;
    onEditMessage: (text: string) => void;
}

// This component adapts ChatMessage[] to Message[] for MessageList
const MessageListAdapter: React.FC<MessageListAdapterProps> = ({ messages, onEditMessage }) => {
    // Convert ChatMessage[] to Message[]
    const adaptedMessages: Message[] = messages.map((msg) => ({
        id: String(msg.id),
        role: msg.sender === 'user' ? 'user' : msg.sender === 'ai' ? 'assistant' : 'system',
        assistantId: 'sidepanel',
        topicId: 'sidepanel',
        createdAt: new Date().toISOString(),
        status: msg.sender === 'user' ? UserMessageStatus.SUCCESS : RobotMessageStatus.SUCCESS,
        blocks: [],
        // Include the text in a block that MessageGroup can render
        text: msg.text,
        thinking: msg.thinking,
    }));

    return <MessageList messages={adaptedMessages} onEditMessage={onEditMessage} />;
};

export default MessageListAdapter;
