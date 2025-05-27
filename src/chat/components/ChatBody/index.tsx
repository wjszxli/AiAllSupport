import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Button,
    Input,
    Tooltip,
    Typography,
    Avatar,
    Spin,
    Empty,
    Modal,
    message as AntdMessage,
} from 'antd';
import {
    RocketOutlined,
    SendOutlined,
    ReloadOutlined,
    CopyOutlined,
    CloseCircleOutlined,
    RobotOutlined,
    UserOutlined,
    BulbOutlined,
    QuestionCircleOutlined,
    EditOutlined,
} from '@ant-design/icons';
import { md } from '@/utils/markdownRenderer';
import { t } from '@/locales/i18n';
// import { useChatMessages } from '@/hooks/useChatMessages'; // 不再使用旧的消息系统
// import { fetchChatCompletion } from '@/services/AiService';
// import { convertSimpleMessage } from '@/utils/message/create';
import { ChatMessage } from '@/types';
// import { createStreamCallback, createStreamProcessor } from '@/services/StreamProcessingService';
import './index.scss';
import { InputMessage, Message } from '@/types/message';
import robotStore from '@/store/robot';
import { getGroupedMessages, getUserMessage } from '@/services/MessageService';

import llmStore from '@/store/llm';
import rootStore from '@/store';
import { MessageThunkService } from '@/store/messageThunk';
import { observer } from 'mobx-react-lite';

const { TextArea } = Input;

interface ChatBodyProps {
    selectedProvider: string;
    userInput: string;
    setUserInput: (value: string) => void;
    suggestedPrompts: string[];
}

const ChatBody: React.FC<ChatBodyProps> = observer(
    ({ selectedProvider, userInput, setUserInput, suggestedPrompts }) => {
        const [displayMessages, setDisplayMessages] = useState<Message[]>([]);

        const inputRef = useRef<any>(null);

        // 使用 useMemo 缓存 selectedTopicId 和 newMessages
        const selectedTopicId = useMemo(
            () => robotStore.selectedRobot.selectedTopicId,
            [robotStore.selectedRobot.selectedTopicId],
        );
        const newMessages = useMemo(
            () => rootStore.messageStore.getMessagesForTopic(selectedTopicId || ''),
            [selectedTopicId, rootStore.messageStore],
        );

        // 移除旧的 useChatMessages hook，使用新的消息系统
        const messagesWrapperRef = useRef<HTMLDivElement>(null);
        const [isLoading, setIsLoading] = useState(false);
        const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

        const copyToClipboard = useCallback(
            (text: string) => {
                navigator.clipboard
                    .writeText(text)
                    .then(() => {
                        AntdMessage.success(t('copied') || '已复制', 2);
                    })
                    .catch(() => {
                        AntdMessage.error(t('failedCopy') || '复制失败');
                    });
            },
            [t],
        );

        const cancelStreamingResponse = useCallback(() => {
            // TODO: 实现取消流式响应的逻辑
            setStreamingMessageId(null);
            setIsLoading(false);
        }, []);

        const regenerateResponse = useCallback(async () => {
            // TODO: 实现重新生成响应的逻辑
        }, []);

        const clearMessages = useCallback(async () => {
            // TODO: 实现清空消息的逻辑
            return true;
        }, []);

        // 使用 useCallback 缓存函数
        const computeDisplayMessages = useCallback(
            (messages: Message[], startIndex: number, displayCount: number) => {
                const reversedMessages = [...messages].reverse();

                // 如果剩余消息数量小于 displayCount，直接返回所有剩余消息
                if (reversedMessages.length - startIndex <= displayCount) {
                    return reversedMessages.slice(startIndex);
                }

                const userIdSet = new Set(); // 用户消息 id 集合
                const assistantIdSet = new Set(); // 助手消息 askId 集合
                const displayMessages: Message[] = [];

                // 处理单条消息的函数
                const processMessage = (message: Message) => {
                    if (!message) return;

                    const idSet = message.role === 'user' ? userIdSet : assistantIdSet;
                    const messageId = message.role === 'user' ? message.id : message.askId;

                    if (!idSet.has(messageId)) {
                        idSet.add(messageId);
                        displayMessages.push(message);
                        return;
                    }
                    // 如果是相同 askId 的助手消息，也要显示
                    displayMessages.push(message);
                };

                // 遍历消息直到满足显示数量要求
                for (
                    let i = startIndex;
                    i < reversedMessages.length &&
                    userIdSet.size + assistantIdSet.size < displayCount;
                    i++
                ) {
                    processMessage(reversedMessages[i]);
                }

                return displayMessages;
            },
            [],
        );

        // 当话题切换时加载消息
        useEffect(() => {
            if (selectedTopicId) {
                console.log('Loading messages for topic:', selectedTopicId);
                const messageService = new MessageThunkService(rootStore);
                messageService.loadTopicMessages(selectedTopicId);
            }
        }, [selectedTopicId]);

        // 当 messages 变化时自动重新计算显示消息
        useEffect(() => {
            const newDisplayMessages = computeDisplayMessages(newMessages, 0, 10);
            setDisplayMessages(newDisplayMessages);
        }, [newMessages, computeDisplayMessages]);

        const groupedMessages = useMemo(
            () => Object.entries(getGroupedMessages(displayMessages)),
            [displayMessages],
        );

        const handleSendMessage = () => {
            if (!userInput.trim() || isLoading) return;

            const { selectedRobot } = robotStore;
            const { selectedTopicId } = selectedRobot;

            if (!selectedTopicId) {
                AntdMessage.error('请先选择一个话题');
                return;
            }

            selectedRobot.model = llmStore.defaultModel;

            const topic = robotStore.selectedRobot.topics.find(
                (topic) => topic.id === selectedTopicId,
            );

            if (!topic) {
                AntdMessage.error('请先选择一个话题');
                return;
            }

            const userMessage: InputMessage = {
                robot: selectedRobot,
                topic: topic,
                content: userInput,
            };

            const { message, blocks } = getUserMessage(userMessage);
            console.log(message, blocks);

            const messageService = new MessageThunkService(rootStore);

            messageService.sendMessage(message, blocks, selectedRobot, selectedTopicId);

            // 清空输入框
            setUserInput('');
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        };

        const clearChat = () => {
            Modal.confirm({
                title: t('clearConfirmTitle'),
                content: t('clearConfirmContent'),
                okText: t('ok'),
                cancelText: t('cancel'),
                onOk: async () => {
                    await clearMessages();
                    if (inputRef.current) {
                        inputRef.current.focus();
                    }
                },
            });
        };

        const renderMessageContent = (msg: ChatMessage) => {
            if (msg.sender === 'system') {
                return <div className="system-message">{msg.text}</div>;
            }

            if (msg.thinking) {
                return (
                    <div className="thinking-message">
                        <div className="thinking-indicator">{msg.thinking}</div>
                        <div dangerouslySetInnerHTML={{ __html: md.render(msg.text || '') }} />
                    </div>
                );
            }

            return <div dangerouslySetInnerHTML={{ __html: md.render(msg.text) }} />;
        };

        const handleEditMessage = (messageText: string) => {
            setUserInput(messageText);
            if (inputRef.current) {
                inputRef.current.focus();
            }
        };

        // 调试信息
        console.log('=== 调试信息 ===');
        console.log('selectedTopicId:', selectedTopicId);
        console.log('messageStore.messageEntities:', rootStore.messageStore.messageEntities);
        console.log('messageStore.messageIdsByTopic:', rootStore.messageStore.messageIdsByTopic);
        console.log('newMessages (from rootStore.messageStore):', newMessages);
        console.log('displayMessages:', displayMessages);
        console.log('groupedMessages:', groupedMessages);
        console.log('==================');

        return (
            <div className="chat-body">
                <div className="messages-container" ref={messagesWrapperRef}>
                    {groupedMessages.length === 0 ? (
                        <div className="welcome-container">
                            <Empty
                                image={
                                    <RocketOutlined
                                        style={{ fontSize: '64px', color: '#1890ff' }}
                                    />
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
                                            onClick={() => {
                                                setUserInput(prompt);
                                                setTimeout(() => {
                                                    if (inputRef.current) {
                                                        inputRef.current.focus();
                                                    }
                                                }, 0);
                                            }}
                                        >
                                            {prompt}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        groupedMessages.map(([key, groupMessages]) => (
                            <div
                                key={key}
                                // className={`message ${
                                //     groupMessages.sender === 'user' ? 'user-message' : 'ai-message'
                                // }`}
                            >
                                {/* <div className="message-avatar">
                                    {msg.sender === 'user' ? (
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
                                            {msg.sender === 'user' ? t('you') : selectedProvider}
                                            <span className="message-time">
                                                {new Date(msg.id).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="message-text">{renderMessageContent(msg)}</div>
                                    {msg.sender === 'ai' && streamingMessageId !== msg.id && (
                                        <div className="message-actions">
                                            <Button
                                                type="text"
                                                icon={<CopyOutlined />}
                                                size="small"
                                                onClick={() => copyToClipboard(msg.text)}
                                                title={t('copy')}
                                            >
                                                {t('copy') || '复制'}
                                            </Button>
                                            <Button
                                                type="text"
                                                icon={<ReloadOutlined />}
                                                size="small"
                                                onClick={() => regenerateResponse()}
                                                title={t('regenerate')}
                                            >
                                                {t('regenerate') || '重新生成'}
                                            </Button>
                                        </div>
                                    )}
                                    {msg.sender === 'user' && (
                                        <div className="message-actions">
                                            <Button
                                                type="text"
                                                icon={<EditOutlined />}
                                                size="small"
                                                onClick={() => handleEditMessage(msg.text)}
                                                title={t('edit') || '修改'}
                                            >
                                                {t('edit') || '修改'}
                                            </Button>
                                        </div>
                                    )}
                                </div> */}
                            </div>
                        ))
                    )}
                    {isLoading && streamingMessageId === null && (
                        <div className="loading-indicator">
                            <Spin size="small" /> <span>{t('thinking')}</span>
                        </div>
                    )}
                </div>

                <div className="chat-footer">
                    <div className="input-container">
                        <TextArea
                            ref={inputRef}
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('typeMessage') || '输入您的问题...'}
                            autoSize={{ minRows: 1, maxRows: 5 }}
                            disabled={isLoading && streamingMessageId === null}
                        />
                        <div className="input-actions">
                            <Tooltip
                                title={
                                    streamingMessageId !== null
                                        ? t('stop') || '停止'
                                        : userInput.trim()
                                        ? t('sendMessage') || '发送'
                                        : t('enterQuestion') || '请输入问题'
                                }
                            >
                                <Button
                                    className={
                                        streamingMessageId !== null ? 'stop-button' : 'send-button'
                                    }
                                    type={streamingMessageId !== null ? 'default' : 'primary'}
                                    icon={
                                        streamingMessageId !== null ? (
                                            <CloseCircleOutlined />
                                        ) : (
                                            <SendOutlined />
                                        )
                                    }
                                    onClick={
                                        streamingMessageId !== null
                                            ? cancelStreamingResponse
                                            : handleSendMessage
                                    }
                                    disabled={
                                        !streamingMessageId && (!userInput.trim() || isLoading)
                                    }
                                >
                                    {streamingMessageId !== null
                                        ? t('stop') || '停止'
                                        : t('send') || '发送'}
                                </Button>
                            </Tooltip>
                        </div>
                    </div>
                    <div className="footer-actions">
                        {newMessages.length > 0 ? (
                            <>
                                <Button
                                    type="text"
                                    onClick={clearChat}
                                    disabled={newMessages.length === 0 || isLoading}
                                    title={t('clear')}
                                >
                                    {t('clear') || '清空对话'}
                                </Button>
                            </>
                        ) : (
                            <div className="footer-tips">
                                <QuestionCircleOutlined />{' '}
                                {t('pressTip') || '按回车键发送，Shift+回车换行'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    },
);

export default ChatBody;
