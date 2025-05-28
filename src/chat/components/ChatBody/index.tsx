import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Tooltip, Typography, Spin, Empty, message as AntdMessage } from 'antd';
import { RocketOutlined, SendOutlined, CloseCircleOutlined, BulbOutlined } from '@ant-design/icons';

import { t } from '@/locales/i18n';

import './index.scss';
import { InputMessage, Message } from '@/types/message';
import robotStore from '@/store/robot';
import { getGroupedMessages, getUserMessage } from '@/services/MessageService';

import llmStore from '@/store/llm';
import rootStore from '@/store';
import { MessageThunkService } from '@/store/messageThunk';
import { observer } from 'mobx-react-lite';
import MessageGroup from '../MessageGroup';

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

        const selectedTopicId = useMemo(
            () => robotStore.selectedRobot.selectedTopicId,
            [robotStore.selectedRobot.selectedTopicId],
        );

        const messages = useMemo(() => {
            const data = rootStore.messageStore.getMessagesForTopic(selectedTopicId || '');
            console.log('data', data);
            return data;
        }, [
            selectedTopicId,
            rootStore.messageStore.messages.size,
            rootStore.messageBlockStore.blocks.size,
        ]);

        const computeDisplayMessages = useCallback((messages: Message[], displayCount: number) => {
            // 不反转消息，保持原始顺序（最新消息在底部）
            const orderedMessages = [...messages];

            // 如果消息数量小于 displayCount，直接返回所有消息
            if (orderedMessages.length <= displayCount) {
                return orderedMessages;
            }

            // 如果消息太多，只显示最新的 displayCount 条消息
            const startIdx = Math.max(0, orderedMessages.length - displayCount);
            return orderedMessages.slice(startIdx);
        }, []);

        useEffect(() => {
            const newDisplayMessages = computeDisplayMessages(messages, 100);
            setDisplayMessages(newDisplayMessages);
        }, [messages, computeDisplayMessages]);

        // 自动滚动到底部
        useEffect(() => {
            if (messagesWrapperRef.current) {
                messagesWrapperRef.current.scrollTop = messagesWrapperRef.current.scrollHeight;
            }
        }, [displayMessages]);

        const messagesWrapperRef = useRef<HTMLDivElement>(null);
        const [isLoading, setIsLoading] = useState(false);
        const streamingMessageId = rootStore.messageStore.streamingMessageId;

        const cancelStreamingResponse = useCallback(() => {
            rootStore.messageStore.setStreamingMessageId(null);
            setIsLoading(false);
        }, []);

        // 当话题变化时加载消息
        useEffect(() => {
            if (selectedTopicId) {
                console.log('加载消息 for topic:', selectedTopicId);
                const messageService = new MessageThunkService(rootStore);
                messageService.loadTopicMessages(selectedTopicId);
            }
        }, [selectedTopicId]);

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

        // 复制消息内容
        const handleCopyMessage = useCallback((text: string) => {
            navigator.clipboard
                .writeText(text)
                .then(() => {
                    AntdMessage.success(t('copied') || '已复制', 2);
                })
                .catch(() => {
                    AntdMessage.error(t('failedCopy') || '复制失败');
                });
        }, []);

        // 重新生成响应
        const handleRegenerateResponse = useCallback(() => {
            // TODO: 实现重新生成响应的逻辑
            console.log('重新生成响应');
        }, []);

        // 编辑消息
        const handleEditMessage = useCallback(
            (text: string) => {
                setUserInput(text);
                if (inputRef.current) {
                    inputRef.current.focus();
                }
            },
            [setUserInput],
        );

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
                        groupedMessages.map(([key, groupMessages]) => {
                            return (
                                <MessageGroup
                                    key={key}
                                    groupKey={key}
                                    messages={groupMessages}
                                    selectedProvider={selectedProvider}
                                    streamingMessageId={streamingMessageId}
                                    onCopyMessage={handleCopyMessage}
                                    onRegenerateResponse={handleRegenerateResponse}
                                    onEditMessage={handleEditMessage}
                                />
                            );
                        })
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
                </div>
            </div>
        );
    },
);

export default ChatBody;
