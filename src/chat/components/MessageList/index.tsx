import React, { useEffect, useRef } from 'react';
import { Empty, Typography, Button } from 'antd';
import { RocketOutlined, BulbOutlined } from '@ant-design/icons';
import { Message } from '@/types/message';
import { t } from '@/locales/i18n';
import MessageGroup from '../MessageGroup';
import { getGroupedMessages } from '@/utils/message/filters';
import { usePromptSuggestions } from '@/chat/hooks/usePromptSuggestions';
import rootStore from '@/store';
import { observer } from 'mobx-react-lite';
import './index.scss';

interface MessageListProps {
    messages: Message[];
    selectedProvider: string;
    onEditMessage: (text: string) => void;
}

const MessageList: React.FC<MessageListProps> = observer(
    ({ messages, selectedProvider, onEditMessage }) => {
        const messagesWrapperRef = useRef<HTMLDivElement>(null);
        const streamingMessageId = rootStore.messageStore.streamingMessageId;

        const { suggestedPrompts, handleSelectPrompt } = usePromptSuggestions();
        const groupedMessages = Object.entries(getGroupedMessages(messages));

        // 自动滚动到底部
        useEffect(() => {
            if (messagesWrapperRef.current) {
                messagesWrapperRef.current.scrollTop = messagesWrapperRef.current.scrollHeight;
            }
        }, [messages]);

        return (
            <div className="messages-container" ref={messagesWrapperRef}>
                {groupedMessages.length === 0 ? (
                    <div className="welcome-container">
                        <Empty
                            image={
                                <RocketOutlined style={{ fontSize: '64px', color: '#1890ff' }} />
                            }
                            description={
                                <Typography.Text strong>{t('welcomeMessage')}</Typography.Text>
                            }
                        />
                        <div className="prompt-suggestions">
                            <Typography.Title level={5}>
                                <BulbOutlined /> {t('tryAsking')}
                            </Typography.Title>
                            <div className="suggestion-items">
                                {suggestedPrompts.map((prompt, index) => (
                                    <Button
                                        key={index}
                                        className="suggestion-item"
                                        onClick={() => handleSelectPrompt(prompt, onEditMessage)}
                                    >
                                        {prompt}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    groupedMessages.map(([key, groupMessages]) => (
                        <MessageGroup
                            key={key}
                            groupKey={key}
                            messages={groupMessages}
                            selectedProvider={selectedProvider}
                            streamingMessageId={streamingMessageId}
                            onEditMessage={onEditMessage}
                        />
                    ))
                )}
            </div>
        );
    },
);

export default MessageList;
