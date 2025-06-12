import React, { useEffect } from 'react';
import { Avatar, Button, message } from 'antd';
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
import MessageRenderer from './MessageRenderer';
import './index.scss';
import { useMessageOperations } from '@/chat/hooks/useMessageOperations';

interface MessageGroupProps {
    groupKey: string;
    messages: (Message & { index: number })[];
    selectedProvider: string;
    streamingMessageId: string | null;
    onEditMessage: (text: string) => void;
}

const MessageGroup: React.FC<MessageGroupProps> = observer(
    ({ messages, selectedProvider, streamingMessageId, onEditMessage }) => {
        if (!messages || messages.length === 0) return null;

        // 使用消息操作 hook
        const {
            getMessageThinking,
            getMessageContent,
            isMessageStreaming,
            handleRegenerateResponse,
            handleCopyMessage,
            getMessageError,
        } = useMessageOperations(streamingMessageId);

        // 获取第一条消息来确定消息类型
        const firstMessage = messages[0];
        const isUserMessage = firstMessage.role === 'user';
        const isAssistantMessage = firstMessage.role === 'assistant';

        // 获取消息时间
        const getMessageTime = (message: Message) => {
            return new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            });
        };

        // 处理复制代码块
        useEffect(() => {
            const handleCopyCode = (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                const copyButton = target.closest('.copy-code-button') as HTMLButtonElement;

                if (copyButton) {
                    e.preventDefault();
                    e.stopPropagation();

                    const codeData = copyButton.getAttribute('data-code');
                    if (codeData) {
                        try {
                            const decodedCode = decodeURIComponent(codeData);
                            navigator.clipboard.writeText(decodedCode).then(() => {
                                // 复制成功提示
                                message.success(t('copy_success') || '复制成功');

                                // 更新按钮文本显示复制成功，然后恢复
                                const textSpan = copyButton.querySelector('span');
                                if (textSpan) {
                                    const originalText = textSpan.textContent;
                                    textSpan.textContent = t('copied') || '已复制';

                                    setTimeout(() => {
                                        textSpan.textContent = originalText;
                                    }, 2000);
                                }
                            });
                        } catch (error) {
                            console.error('Copy failed:', error);
                            message.error(t('copy_failed') || '复制失败');
                        }
                    }
                }
            };

            // 添加事件监听器
            document.addEventListener('click', handleCopyCode);

            // 清理函数
            return () => {
                document.removeEventListener('click', handleCopyCode);
            };
        }, []);

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
                            const thinkingContent = getMessageThinking(message);
                            const errorContent = getMessageError(message);

                            return (
                                <div key={message.id} className="message-item">
                                    <div className="message-text">
                                        <MessageRenderer
                                            thinkingContent={thinkingContent}
                                            content={content}
                                            messageId={message.id}
                                            isStreaming={isStreaming}
                                            errorContent={errorContent}
                                        />
                                    </div>
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
                                        handleCopyMessage(content);
                                    }}
                                    title={t('copy') || '复制'}
                                >
                                    {t('copy') || '复制'}
                                </Button>
                                <Button
                                    type="text"
                                    icon={<ReloadOutlined />}
                                    size="small"
                                    onClick={() => handleRegenerateResponse(firstMessage)}
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
