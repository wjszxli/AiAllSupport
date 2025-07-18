import React, { useEffect, useRef } from 'react';
import { Empty, Typography, Button } from 'antd';
import { RocketOutlined, BulbOutlined, ReloadOutlined } from '@ant-design/icons';
import { Message } from '@/types/message';
import { t } from '@/locales/i18n';
import MessageGroup from '@/components/MessageGroup';
import { getGroupedMessages } from '@/utils/message/filters';
import { usePromptSuggestions } from '@/chat/hooks/usePromptSuggestions';
import rootStore from '@/store';
import { observer } from 'mobx-react-lite';
import './index.scss';
import { Robot } from '@/types';

interface MessageListProps {
    messages: Message[];
    onEditMessage: (text: string) => void;
    selectedRobot?: Robot;
}

const MessageList: React.FC<MessageListProps> = observer(
    ({ messages, onEditMessage, selectedRobot }) => {
        const messagesWrapperRef = useRef<HTMLDivElement>(null);
        const streamingMessageId = rootStore.messageStore.streamingMessageId;

        const { suggestedPrompts, handleSelectPrompt, refreshPrompts } = usePromptSuggestions();
        const groupedMessages = Object.entries(getGroupedMessages(messages));

        // 自动滚动到底部
        useEffect(() => {
            if (messagesWrapperRef.current) {
                const scrollElement = messagesWrapperRef.current;

                // 当有新消息或流式响应时，总是滚动到底部
                if (messages.length > 0 || streamingMessageId) {
                    requestAnimationFrame(() => {
                        scrollElement.scrollTop = scrollElement.scrollHeight;
                    });
                }
            }
        }, [messages, streamingMessageId]);

        // 当消息内容更新时（流式响应中），持续滚动到底部
        useEffect(() => {
            if (streamingMessageId && messagesWrapperRef.current) {
                const scrollElement = messagesWrapperRef.current;
                const scrollToBottom = () => {
                    scrollElement.scrollTop = scrollElement.scrollHeight;
                };

                // 使用 MutationObserver 监听内容变化
                const observer = new MutationObserver(scrollToBottom);
                observer.observe(scrollElement, {
                    childList: true,
                    subtree: true,
                    characterData: true,
                });

                return () => observer.disconnect();
            }
            return () => {};
        }, [streamingMessageId]);

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
                            <div className="suggestions-header">
                                <Typography.Title level={5}>
                                    <BulbOutlined /> {t('tryAsking')}
                                </Typography.Title>
                                <Button
                                    type="text"
                                    icon={<ReloadOutlined />}
                                    size="small"
                                    onClick={refreshPrompts}
                                    className="refresh-button"
                                    title="刷新提示词"
                                >
                                    换一批
                                </Button>
                            </div>
                            <div className="suggestion-items">
                                {suggestedPrompts.map((prompt, index) => (
                                    <Button
                                        key={`${prompt}-${index}`}
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
                    <>
                        {groupedMessages.map(([groupKey, groupMessages]) => (
                            <MessageGroup
                                key={groupKey}
                                groupKey={groupKey}
                                messages={groupMessages}
                                streamingMessageId={streamingMessageId}
                                onEditMessage={onEditMessage}
                                selectedRobot={selectedRobot}
                            />
                        ))}
                    </>
                )}
            </div>
        );
    },
);

export default MessageList;
