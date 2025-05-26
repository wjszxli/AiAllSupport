import React, { useRef } from 'react';
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
import { useChatMessages } from '@/hooks/useChatMessages';
// import { fetchChatCompletion } from '@/services/apiService';
// import { convertSimpleMessage } from '@/utils/message/create';
import { ChatMessage } from '@/types';
// import { createStreamCallback, createStreamProcessor } from '@/services/StreamProcessingService';
import './index.scss';
import { InputMessage } from '@/types/message';
import robotStore from '@/store/robot';
import { getUserMessage } from '@/services/MessageService';
import { getTopicQueue } from '@/utils/queue';

const { TextArea } = Input;

interface ChatBodyProps {
    selectedProvider: string;
    userInput: string;
    setUserInput: (value: string) => void;
    suggestedPrompts: string[];
}

const ChatBody: React.FC<ChatBodyProps> = ({
    selectedProvider,
    userInput,
    setUserInput,
    suggestedPrompts,
}) => {
    const inputRef = useRef<any>(null);

    const {
        messages,
        isLoading,
        streamingMessageId,
        messagesWrapperRef,
        copyToClipboard,
        cancelStreamingResponse,
        regenerateResponse,
        clearMessages,
    } = useChatMessages({
        t,
        storeType: 'app',
        conversationId: 'default',
    });

    const handleSendMessage = () => {
        if (!userInput.trim() || isLoading) return;

        const { selectedRobot } = robotStore;
        const { selectedTopicId } = selectedRobot;

        if (!selectedTopicId) {
            AntdMessage.error('请先选择一个话题');
            return;
        }

        const topic = robotStore.selectedRobot.topics.find((topic) => topic.id === selectedTopicId);

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
        const queue = getTopicQueue(selectedTopicId);

        queue.add(async () => {
            // await fetchAndProcessAssistantResponseImpl(
            //     dispatch,
            //     getState,
            //     topicId,
            //     assistant,
            //     assistantMessage,
            // );
        });
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

    return (
        <div className="chat-body">
            <div className="messages-container" ref={messagesWrapperRef}>
                {messages.length === 0 ? (
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
                    messages.map((msg, _) => (
                        <div
                            key={msg.id}
                            className={`message ${
                                msg.sender === 'user' ? 'user-message' : 'ai-message'
                            }`}
                        >
                            <div className="message-avatar">
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
                            </div>
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
                                disabled={!streamingMessageId && (!userInput.trim() || isLoading)}
                            >
                                {streamingMessageId !== null
                                    ? t('stop') || '停止'
                                    : t('send') || '发送'}
                            </Button>
                        </Tooltip>
                    </div>
                </div>
                <div className="footer-actions">
                    {messages.length > 0 ? (
                        <>
                            <Button
                                type="text"
                                onClick={clearChat}
                                disabled={messages.length === 0 || isLoading}
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
};

export default ChatBody;
