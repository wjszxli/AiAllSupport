import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Tooltip, Modal, message } from 'antd';
import {
    SendOutlined,
    CloseCircleOutlined,
    DownOutlined,
    UpOutlined,
    EditOutlined,
    DeleteOutlined,
    ExpandOutlined,
    ShrinkOutlined,
    SearchOutlined,
} from '@ant-design/icons';

import { t } from '@/locales/i18n';

import './index.scss';
import { Message } from '@/types/message';
import robotStore from '@/store/robot';

import rootStore from '@/store';
import { observer } from 'mobx-react-lite';
import MessageList from '../../../components/MessageList';
import { useMessageSender } from '@/chat/hooks/useMessageSender';
import { getMessageService } from '@/services/MessageService';
import { md } from '@/utils/markdownRenderer';
import DOMPurify from 'dompurify';
import EditRobotModal from '../Robot/components/EditRobotModal';

const { TextArea } = Input;

interface ChatBodyProps {
    userInput: string;
    setUserInput: (value: string) => void;
}

const ChatBody: React.FC<ChatBodyProps> = observer(({ userInput, setUserInput }) => {
    const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showFullPrompt, setShowFullPrompt] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isInputExpanded, setIsInputExpanded] = useState(false);
    const inputRef = useRef<any>(null);

    // 获取当前机器人
    const selectedRobot = useMemo(() => robotStore.selectedRobot, [robotStore.selectedRobot]);

    const selectedTopicId = useMemo(
        () => selectedRobot?.selectedTopicId || '',
        [selectedRobot?.selectedTopicId],
    );

    // 获取当前机器人的prompt
    const currentRobotPrompt = useMemo(() => selectedRobot?.prompt || '', [selectedRobot?.prompt]);

    // 检查是否应该显示提示词
    const shouldShowPrompt = useMemo(() => {
        // 如果明确设置为false则不显示，否则默认显示(true或undefined)
        return selectedRobot?.showPrompt !== false && !!currentRobotPrompt;
    }, [selectedRobot?.showPrompt, currentRobotPrompt]);

    // 处理 prompt 的截断与渲染
    const renderedPrompt = useMemo(() => {
        if (!currentRobotPrompt) return { short: '', full: '' };

        const fullPrompt = md.render(currentRobotPrompt);

        // 创建一个纯文本版本用于计算字符数
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = fullPrompt;
        const textContent = tempDiv.textContent || '';

        // 如果总长度小于 100，则不需要截断
        if (textContent.length <= 100) {
            return { short: fullPrompt, full: fullPrompt, needsExpand: false };
        }

        // 截取前 100 个字符的纯文本内容
        const shortText = textContent.substring(0, 100) + '...';

        // 创建截断的 HTML
        const shortPrompt = md.render(shortText);

        return {
            short: shortPrompt,
            full: fullPrompt,
            needsExpand: true,
        };
    }, [currentRobotPrompt]);

    const messages = useMemo(() => {
        const data = rootStore.messageStore.getMessagesForTopic(selectedTopicId || '');
        return data;
    }, [
        selectedTopicId,
        rootStore.messageStore.messages.size,
        rootStore.messageBlockStore.blocks.size,
    ]);

    const streamingMessageId = rootStore.messageStore.streamingMessageId;

    // 使用消息发送 hook
    const { handleSendMessage } = useMessageSender();

    // 获取 MessageService 实例
    const messageService = useMemo(() => getMessageService(rootStore), []);

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

    const cancelStreamingResponse = useCallback(() => {
        // 使用独立的 MessageService 来正确取消流式响应
        messageService.cancelCurrentStream(selectedTopicId);

        setIsLoading(false);
    }, [streamingMessageId, messageService]);

    // 当话题变化时加载消息
    useEffect(() => {
        if (selectedTopicId) {
            // 只有在没有正在流式处理的消息时才重新加载
            // 避免在流式过程中清理当前的流式块
            if (!streamingMessageId) {
                messageService.loadTopicMessages(selectedTopicId);
            }
        }
    }, [selectedTopicId, streamingMessageId, messageService]);

    const handleSendMessageClick = () => {
        if (!userInput.trim() || isLoading) return;

        handleSendMessage({
            userInput,
            robot: selectedRobot,
            onSuccess: () => {
                setUserInput('');
            },
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessageClick();
        }
    };

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

    // 切换显示完整或截断的提示词
    const toggleShowFullPrompt = (e: React.MouseEvent) => {
        e.stopPropagation(); // 阻止事件冒泡到容器
        setShowFullPrompt((prev) => !prev);
    };

    // 打开编辑机器人对话框
    const openEditRobot = useCallback(() => {
        if (!selectedRobot) return;

        // 打开编辑机器人对话框
        setIsEditModalVisible(true);
    }, [selectedRobot]);

    // 关闭编辑机器人对话框
    const handleEditCancel = useCallback(() => {
        setIsEditModalVisible(false);
    }, []);

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

    // 切换输入框展开状态
    const toggleInputExpanded = useCallback(() => {
        setIsInputExpanded((prev) => !prev);
    }, []);

    return (
        <div className="chat-body">
            {shouldShowPrompt && (
                <div className="robot-prompt-container" onClick={openEditRobot}>
                    <div className="robot-prompt-content">
                        <h4>
                            {t('robotPrompt') || '机器人提示词'}
                            <EditOutlined className="edit-prompt-icon" />
                        </h4>
                        <div
                            className="markdown-content prompt-markdown"
                            dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(
                                    showFullPrompt ? renderedPrompt.full : renderedPrompt.short,
                                ),
                            }}
                        />
                        {renderedPrompt.needsExpand && (
                            <Button
                                type="link"
                                onClick={toggleShowFullPrompt}
                                className="toggle-prompt-btn"
                                icon={showFullPrompt ? <UpOutlined /> : <DownOutlined />}
                            >
                                {showFullPrompt ? t('showLess') || '收起' : t('showMore') || '展开'}
                            </Button>
                        )}
                    </div>
                </div>
            )}
            <MessageList
                messages={displayMessages}
                onEditMessage={handleEditMessage}
                selectedRobot={selectedRobot || undefined}
            />
            <div className="chat-footer">
                <div className="input-container">
                    <div className="textarea-container">
                        <div className="text-input-area">
                            <TextArea
                                ref={inputRef}
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t('typeMessage') || '输入您的问题...'}
                                autoSize={{
                                    minRows: isInputExpanded ? 12 : 3,
                                    maxRows: isInputExpanded ? 30 : 8,
                                }}
                                disabled={isLoading && streamingMessageId === null}
                                bordered={false}
                            />
                        </div>
                        <div className="input-toolbar">
                            <div className="toolbar-left">
                                {/* 搜索开关按钮 */}
                                <Tooltip
                                    title={
                                        rootStore.settingStore.webSearchEnabled
                                            ? '关闭网页搜索'
                                            : '开启网页搜索'
                                    }
                                    overlayStyle={{ zIndex: 10001 }}
                                >
                                    <Button
                                        type={
                                            rootStore.settingStore.webSearchEnabled
                                                ? 'primary'
                                                : 'text'
                                        }
                                        size="small"
                                        icon={<SearchOutlined />}
                                        onClick={() => {
                                            rootStore.settingStore.setWebSearchEnabled(
                                                !rootStore.settingStore.webSearchEnabled,
                                            );
                                        }}
                                        className="search-toggle-button"
                                    />
                                </Tooltip>

                                {/* 展开/收起按钮 */}
                                <Tooltip
                                    title={isInputExpanded ? '收起输入框' : '展开输入框'}
                                    overlayStyle={{ zIndex: 10001 }}
                                >
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={
                                            isInputExpanded ? (
                                                <ShrinkOutlined />
                                            ) : (
                                                <ExpandOutlined />
                                            )
                                        }
                                        onClick={toggleInputExpanded}
                                        className="expand-button"
                                    />
                                </Tooltip>

                                {/* 清空消息按钮 */}
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
                            <div className="toolbar-right">
                                {/* 发送/停止按钮 - 独占右侧 */}
                                <Tooltip
                                    title={
                                        streamingMessageId !== null
                                            ? t('stop') || '停止'
                                            : userInput.trim()
                                            ? t('sendMessage') || '发送'
                                            : t('enterQuestion') || '请输入问题'
                                    }
                                    overlayStyle={{ zIndex: 10001 }}
                                >
                                    <Button
                                        className={
                                            streamingMessageId !== null
                                                ? 'stop-button'
                                                : 'send-button'
                                        }
                                        type={streamingMessageId !== null ? 'default' : 'primary'}
                                        size="small"
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
                                                : handleSendMessageClick
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
            </div>
            <EditRobotModal
                isVisible={isEditModalVisible}
                onCancel={handleEditCancel}
                editingRobot={selectedRobot}
            />
        </div>
    );
});

export default ChatBody;
