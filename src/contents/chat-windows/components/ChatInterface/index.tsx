import { t } from '@/locales/i18n';
import rootStore from '@/store';
import { Button, Input, Tooltip, Modal, message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ExpandOutlined,
    ShrinkOutlined,
    SendOutlined,
    StopOutlined,
    DeleteOutlined,
} from '@ant-design/icons';

import './index.scss';
import { useMessageSender } from '@/chat/hooks/useMessageSender';
import { ConfigModelType } from '@/types';
import { Message } from '@/types/message';
import MessageList from '@/chat/components/MessageList';
import getMessageService from '@/services/MessageService';
import { observer } from 'mobx-react-lite';

const ChatInterface = observer(({ initialText }: { initialText?: string }) => {
    const [inputMessage, setInputMessage] = useState(initialText || '');
    const [isComposing, setIsComposing] = useState(false);
    const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
    const [isInputExpanded, setIsInputExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef<any>(null);

    const streamingMessageId = rootStore.messageStore.streamingMessageId;
    const { handleSendMessage } = useMessageSender();

    const selectedRobot = rootStore.llmStore.getRobotForType(ConfigModelType.POPUP);
    const selectedTopicId = useMemo(
        () => selectedRobot?.selectedTopicId || '',
        [selectedRobot?.selectedTopicId],
    );

    const messageService = useMemo(() => getMessageService(rootStore), []);

    // 当话题变化时加载消息
    useEffect(() => {
        console.log('loadTopicMessages', selectedTopicId);
        if (selectedTopicId) {
            // 只有在没有正在流式处理的消息时才重新加载
            // 避免在流式过程中清理当前的流式块
            if (!streamingMessageId) {
                messageService.loadTopicMessages(selectedTopicId);
            }
        }
    }, [selectedTopicId, streamingMessageId, messageService]);

    // 使用 MobX 的响应式数据，移除 useMemo 以确保正确跟踪状态变化
    const messages = useMemo(() => {
        const data = rootStore.messageStore.getMessagesForTopic(selectedTopicId || '');
        return data;
    }, [
        selectedTopicId,
        rootStore.messageStore.messages.size,
        rootStore.messageBlockStore.blocks.size,
    ]);

    console.log('messages', messages);
    console.log('selectedTopicId', selectedTopicId);

    const computeDisplayMessages = useCallback((messages: Message[], displayCount: number) => {
        const orderedMessages = [...messages];
        if (orderedMessages.length <= displayCount) {
            return orderedMessages;
        }
        const startIdx = Math.max(0, orderedMessages.length - displayCount);
        return orderedMessages.slice(startIdx);
    }, []);

    useEffect(() => {
        const newDisplayMessages = computeDisplayMessages(messages, 100);
        setDisplayMessages(newDisplayMessages);
    }, [messages, computeDisplayMessages]);

    console.log('displayMessages', displayMessages);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setInputMessage(newValue);
    };

    const handleCompositionStart = () => {
        setIsComposing(true);
    };

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
        setIsComposing(false);
        setInputMessage((e.target as HTMLTextAreaElement).value);
    };

    const handleSendMessageClick = () => {
        console.log('handleSendMessageClick', inputMessage);
        if (!inputMessage.trim() || isLoading) return;

        if (!selectedRobot) {
            message.error('请先选择机器人');
            return;
        }

        handleSendMessage({
            userInput: inputMessage,
            robot: selectedRobot,
            onSuccess: () => {
                setInputMessage('');
            },
        });
    };

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            // 按回车键发送消息，但排除以下情况：
            // 1. 同时按住了Shift键（Shift+Enter换行）
            // 2. 正在进行输入法组合输入（isComposing为true）
            if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
                e.preventDefault();
                handleSendMessageClick();
            }
        },
        [isComposing, handleSendMessageClick],
    );

    const handleEditMessage = useCallback(
        (text: string) => {
            setInputMessage(text);
            if (inputRef.current) {
                inputRef.current.focus();
            }
        },
        [setInputMessage],
    );

    const toggleInputExpanded = useCallback(() => {
        setIsInputExpanded(!isInputExpanded);
    }, [isInputExpanded]);

    // 取消流式响应
    const cancelStreamingResponse = useCallback(() => {
        if (selectedTopicId) {
            messageService.cancelCurrentStream(selectedTopicId);
        }
        setIsLoading(false);
    }, [messageService, selectedTopicId]);

    // 清空消息处理函数
    const handleClearMessages = useCallback(async () => {
        if (!selectedTopicId || !selectedRobot) {
            message.error('无法清空消息：未选择话题或机器人');
            return;
        }

        Modal.confirm({
            title: '清空聊天记录',
            content: '确定要清空当前对话的所有消息吗？此操作不可撤销。',
            okText: '确认清空',
            cancelText: '取消',
            okType: 'danger',
            zIndex: 10000,
            onOk: async () => {
                try {
                    await messageService.clearTopicMessages(selectedTopicId);
                    message.success('聊天记录已清空');
                } catch (error) {
                    console.error('Error clearing messages:', error);
                    message.error('清空消息失败');
                }
            },
        });
    }, [selectedTopicId, selectedRobot, messageService]);

    // 处理发送或停止按钮点击
    const handleButtonClick = useCallback(() => {
        if (streamingMessageId) {
            // 如果正在流式输出，则停止
            cancelStreamingResponse();
        } else {
            // 否则发送消息
            handleSendMessageClick();
        }
    }, [streamingMessageId, cancelStreamingResponse, handleSendMessageClick]);

    return (
        <div className="chat-interface-container">
            <MessageList
                messages={displayMessages}
                onEditMessage={handleEditMessage}
                selectedRobot={selectedRobot || undefined}
            />
            <div className="input-container">
                <div className="input-wrapper">
                    <div className="textarea-wrapper">
                        <Input.TextArea
                            ref={inputRef}
                            value={inputMessage}
                            onChange={handleInputChange}
                            onCompositionStart={handleCompositionStart}
                            onCompositionEnd={handleCompositionEnd}
                            onKeyDown={handleKeyDown}
                            placeholder={t('typeMessage')}
                            autoSize={{
                                minRows: isInputExpanded ? 8 : 2,
                                maxRows: isInputExpanded ? 20 : 4,
                            }}
                            className="message-input"
                        />
                        <div className="input-controls">
                            <Tooltip
                                title={isInputExpanded ? '收起输入框' : '展开输入框'}
                                overlayStyle={{ zIndex: 10001 }}
                            >
                                <Button
                                    type="text"
                                    size="small"
                                    icon={isInputExpanded ? <ShrinkOutlined /> : <ExpandOutlined />}
                                    onClick={toggleInputExpanded}
                                    className="expand-button"
                                />
                            </Tooltip>
                            {displayMessages.length > 0 && !streamingMessageId && (
                                <Tooltip title="清空聊天记录" overlayStyle={{ zIndex: 10001 }}>
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<DeleteOutlined />}
                                        onClick={handleClearMessages}
                                        className="clear-button"
                                        disabled={isLoading}
                                    />
                                </Tooltip>
                            )}
                        </div>
                    </div>
                </div>
                <Button
                    type="primary"
                    icon={streamingMessageId ? <StopOutlined /> : <SendOutlined />}
                    onClick={handleButtonClick}
                    className={streamingMessageId ? 'stop-message-button' : 'send-message-button'}
                    disabled={!streamingMessageId && (!inputMessage.trim() || isLoading)}
                >
                    {streamingMessageId ? t('stop') : t('send')}
                </Button>
            </div>
        </div>
    );
});

export default ChatInterface;
