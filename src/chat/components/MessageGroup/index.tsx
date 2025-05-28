import React from 'react';
import { Avatar, Button, Typography } from 'antd';
import {
    UserOutlined,
    RobotOutlined,
    CopyOutlined,
    ReloadOutlined,
    EditOutlined,
} from '@ant-design/icons';
import { Message } from '@/types/message';
import { MessageBlockType, MessageBlockStatus } from '@/types/messageBlock';
import { md } from '@/utils/markdownRenderer';
import { t } from '@/locales/i18n';
import rootStore from '@/store';
import { observer } from 'mobx-react-lite';
import './index.scss';

interface MessageGroupProps {
    groupKey: string;
    messages: (Message & { index: number })[];
    selectedProvider: string;
    streamingMessageId: string | null;
    onCopyMessage: (text: string) => void;
    onRegenerateResponse: () => void;
    onEditMessage: (text: string) => void;
}

const MessageGroup: React.FC<MessageGroupProps> = observer(
    ({
        messages,
        selectedProvider,
        streamingMessageId,
        onCopyMessage,
        onRegenerateResponse,
        onEditMessage,
    }) => {
        if (!messages || messages.length === 0) return null;

        // 获取第一条消息来确定消息类型
        const firstMessage = messages[0];
        const isUserMessage = firstMessage.role === 'user';
        const isAssistantMessage = firstMessage.role === 'assistant';

        // 获取消息内容（从 MessageBlock 中获取）
        const getMessageContent = (message: Message): string => {
            if (!message.blocks || message.blocks.length === 0) {
                console.log(`[getMessageContent] Message ${message.id} has no blocks`);
                return '';
            }

            console.log(
                `[getMessageContent] Processing message ${message.id} with ${message.blocks.length} block IDs:`,
                message.blocks,
            );

            const blocks = message.blocks
                .map((blockId) => {
                    const block = rootStore.messageBlockStore.getBlockById(blockId);
                    if (!block) {
                        console.warn(`[getMessageContent] Block ${blockId} not found in store`);
                    } else {
                        console.log(`[getMessageContent] Found block ${blockId}:`, {
                            type: block.type,
                            status: block.status,
                            hasContent: 'content' in block,
                            contentLength:
                                'content' in block ? (block as any).content?.length || 0 : 0,
                        });
                    }
                    return block;
                })
                .filter(Boolean);

            if (blocks.length === 0) {
                console.warn(`[getMessageContent] No valid blocks found for message ${message.id}`);
                return '';
            }

            const content = blocks
                .filter((block): block is NonNullable<typeof block> => {
                    // 检查块类型和是否有 content 属性
                    if (!block) return false;

                    const hasContent =
                        block.type === MessageBlockType.MAIN_TEXT ||
                        block.type === MessageBlockType.THINKING ||
                        block.type === MessageBlockType.CODE;

                    const hasContentProperty = 'content' in block;

                    console.log(`[getMessageContent] Block ${block.id} filter check:`, {
                        type: block.type,
                        hasContent,
                        hasContentProperty,
                        willInclude: hasContent && hasContentProperty,
                    });

                    return hasContent && hasContentProperty;
                })
                .map((block) => {
                    const content = (block as any).content || '';
                    console.log(
                        `[getMessageContent] Extracting content from block ${block.id}: ${content.length} chars`,
                    );
                    return content;
                })
                .join('');

            console.log(
                `[getMessageContent] Message ${message.id} final content length: ${content.length}`,
            );
            return content;
        };

        // 检查消息是否正在流式显示
        const isMessageStreaming = (message: Message): boolean => {
            // 首先检查是否是当前流式消息
            if (streamingMessageId === message.id) {
                return true;
            }

            // 其次检查消息的块是否有流式状态
            if (message.blocks && message.blocks.length > 0) {
                return message.blocks.some((blockId) => {
                    const block = rootStore.messageBlockStore.getBlockById(blockId);
                    return block && block.status === MessageBlockStatus.STREAMING;
                });
            }

            return false;
        };

        // 渲染消息内容
        const renderMessageContent = (content: string, isStreaming: boolean = false) => {
            if (!content) return <div className="empty-content">暂无内容</div>;

            return (
                <div
                    className={`message-text ${isStreaming ? 'streaming' : ''}`}
                    dangerouslySetInnerHTML={{ __html: md.render(content) }}
                />
            );
        };

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
                        {messages.map((message, index) => {
                            const content = getMessageContent(message);
                            const isStreaming = isMessageStreaming(message);

                            return (
                                <div key={message.id} className="message-item">
                                    {renderMessageContent(content, isStreaming)}

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
