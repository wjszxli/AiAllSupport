import React from 'react';
import { Avatar, Button } from 'antd';
import {
    UserOutlined,
    RobotOutlined,
    CopyOutlined,
    ReloadOutlined,
    EditOutlined,
} from '@ant-design/icons';
import { Message } from '@/types/message';
import { t } from '@/locales/i18n';
import { observer } from 'mobx-react-lite';
import { useMessageRenderer } from '@/chat/hooks/useMessageRenderer';
import './index.scss';

interface MessageGroupProps {
    groupKey: string;
    messages: (Message & { index: number })[];
    selectedProvider: string;
    streamingMessageId: string | null;
    getMessageContent: (message: Message) => string;
    isMessageStreaming: (message: Message) => boolean;
    onCopyMessage: (text: string) => void;
    onRegenerateResponse: () => void;
    onEditMessage: (text: string) => void;
}

const MessageGroup: React.FC<MessageGroupProps> = observer(
    ({
        messages,
        selectedProvider,
        streamingMessageId,
        getMessageContent,
        isMessageStreaming,
        onCopyMessage,
        onRegenerateResponse,
        onEditMessage,
    }) => {
        if (!messages || messages.length === 0) return null;

        // 获取第一条消息来确定消息类型
        const firstMessage = messages[0];
        const isUserMessage = firstMessage.role === 'user';
        const isAssistantMessage = firstMessage.role === 'assistant';

        // 使用消息渲染 hook
        const { renderMessageContent } = useMessageRenderer();

        // 获取消息时间
        const getMessageTime = (message: Message) => {
            return new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            });
        };

        return (
            <div className={`message-group ${isUserMessage ? 'user-group' : 'assistant-group'}`}>
                <div className="message-avatar">
                    {isUserMessage ? (
                        <Avatar
                            icon={<UserOutlined />}
                            style={{
                                backgroundColor: '#8e54e9',
                                color: 'white',
                            }}
                        />
                    ) : (
                        <Avatar
                            icon={<RobotOutlined />}
                            style={{
                                backgroundColor: '#fff',
                                color: '#06b6d4',
                                border: '1px solid #e1e4e8',
                            }}
                        />
                    )}
                </div>

                <div className="message-content">
                    <div className="message-header">
                        <div className="message-sender">
                            <span className="sender-name">
                                {isUserMessage ? t('you') || '你' : selectedProvider}
                            </span>
                            <span className="message-time">{getMessageTime(firstMessage)}</span>
                        </div>
                    </div>

                    <div className="message-body">
                        {messages.map((message) => {
                            const content = getMessageContent(message);
                            const isStreaming = isMessageStreaming(message);

                            return (
                                <div key={message.id} className="message-item">
                                    <div
                                        className="message-text"
                                        dangerouslySetInnerHTML={{
                                            __html: renderMessageContent(content, isStreaming),
                                        }}
                                    />

                                    {/* 流式加载指示器 */}
                                    {isStreaming && (
                                        <div className="streaming-indicator">
                                            <span className="typing-dots">
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 消息操作按钮 */}
                    <div className="message-actions">
                        {isAssistantMessage && streamingMessageId !== firstMessage.id && (
                            <>
                                <Button
                                    type="text"
                                    icon={<CopyOutlined />}
                                    size="small"
                                    onClick={() => {
                                        const content = getMessageContent(firstMessage);
                                        onCopyMessage(content);
                                    }}
                                    title={t('copy') || '复制'}
                                >
                                    {t('copy') || '复制'}
                                </Button>
                                <Button
                                    type="text"
                                    icon={<ReloadOutlined />}
                                    size="small"
                                    onClick={onRegenerateResponse}
                                    title={t('regenerate') || '重新生成'}
                                >
                                    {t('regenerate') || '重新生成'}
                                </Button>
                            </>
                        )}

                        {isUserMessage && (
                            <Button
                                type="text"
                                icon={<EditOutlined />}
                                size="small"
                                onClick={() => {
                                    const content = getMessageContent(firstMessage);
                                    onEditMessage(content);
                                }}
                                title={t('edit') || '编辑'}
                            >
                                {t('edit') || '编辑'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );
    },
);

export default MessageGroup;
