import React, { useEffect, useState, useMemo } from 'react';
import { Avatar, Button, message as messageApi } from 'antd';
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
import robotStore from '@/store/robot';
import { getProviderName } from '@/utils/i18n';
import { getProviderLogo } from '@/config/providers';
import rootStore from '@/store';

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

        // 获取当前机器人信息（作为后备）
        const selectedRobot = robotStore.selectedRobot;

        // 状态保存提供商图标和显示名称
        const [providerIcon, setProviderIcon] = useState<string | null>(null);
        const [displayName, setDisplayName] = useState<string>(selectedProvider);

        // 从消息块中获取模型和提供商信息
        const messageModel = useMemo(() => {
            if (isUserMessage) return null;

            // 从消息块中获取模型信息
            if (firstMessage.blocks && firstMessage.blocks.length > 0) {
                // 遍历所有块，查找包含模型信息的块
                for (const blockId of firstMessage.blocks) {
                    const block = rootStore.messageBlockStore.getBlockById(blockId);
                    if (block?.model) {
                        console.log(
                            `[MessageGroup] 从块 ${blockId} 中获取到模型信息:`,
                            block.model,
                        );
                        return block.model;
                    }
                }
            }

            // 如果消息本身有模型信息，使用它
            if (firstMessage.model) {
                console.log(
                    `[MessageGroup] 从消息 ${firstMessage.id} 中获取到模型信息:`,
                    firstMessage.model,
                );
                return firstMessage.model;
            }

            // 后备：使用当前选中的机器人的模型
            const fallbackModel = selectedRobot?.model || selectedRobot?.defaultModel;
            console.log(`[MessageGroup] 使用后备模型:`, fallbackModel);
            return fallbackModel || null;
        }, [firstMessage, selectedRobot]);

        // 当消息模型或提供商变化时更新图标和名称
        useEffect(() => {
            console.log(
                `[MessageGroup] 更新提供商信息，消息 ${firstMessage.id}，模型:`,
                messageModel,
            );
            updateProviderInfo();
        }, [messageModel, selectedProvider, firstMessage.id]);

        // 更新提供商信息
        const updateProviderInfo = () => {
            setProviderIcon(getProviderIcon());
            setDisplayName(getRobotDisplayName());
        };

        // 获取消息时间
        const getMessageTime = (message: Message) => {
            return new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            });
        };

        // 获取显示的机器人名称
        const getRobotDisplayName = () => {
            if (isUserMessage) return t('you') || '你';

            // 如果有消息特定的模型信息，使用它
            if (messageModel) {
                const providerId = messageModel.provider;

                // 创建Provider对象以便使用getProviderName函数
                const provider = {
                    id: providerId,
                    name: messageModel.group || providerId,
                    type: 'openai' as any,
                    apiKey: '',
                    apiHost: '',
                    models: [],
                };

                // 获取本地化的提供商名称
                const localizedProviderName = getProviderName(provider);

                // 获取模型名称
                const modelName = messageModel.name || '';

                // 按照格式：提供商名称 | 模型名称
                return modelName
                    ? `${localizedProviderName} | ${modelName}`
                    : localizedProviderName;
            }

            // 后备：使用选定的提供商
            return selectedProvider;
        };

        // 获取提供商图标
        const getProviderIcon = () => {
            if (isUserMessage) return null;

            // 如果有消息特定的模型信息，使用它
            if (messageModel) {
                const providerId = messageModel.provider;
                return getProviderLogo(providerId);
            }

            // 后备：使用选定的提供商
            return selectedProvider ? getProviderLogo(selectedProvider) : null;
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
                                messageApi.success(t('copy_success') || '复制成功');

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
                            messageApi.error(t('copy_failed') || '复制失败');
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
                            src={providerIcon}
                            icon={!providerIcon && <RobotOutlined />}
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
                                {isUserMessage ? t('you') || '你' : displayName}
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
