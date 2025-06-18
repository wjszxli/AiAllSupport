import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Tooltip } from 'antd';
import {
    SendOutlined,
    CloseCircleOutlined,
    DownOutlined,
    UpOutlined,
    EditOutlined,
} from '@ant-design/icons';

import { t } from '@/locales/i18n';

import './index.scss';
import { Message } from '@/types/message';
import robotStore from '@/store/robot';

import rootStore from '@/store';
import { observer } from 'mobx-react-lite';
import MessageList from '../MessageList';
import { useMessageSender } from '@/chat/hooks/useMessageSender';
import { getMessageService } from '@/services/MessageService';
import { md } from '@/utils/markdownRenderer';
import DOMPurify from 'dompurify';
import EditRobotModal from '../Robot/components/EditRobotModal';

const { TextArea } = Input;

interface ChatBodyProps {
    selectedProvider: string;
    userInput: string;
    setUserInput: (value: string) => void;
}

const ChatBody: React.FC<ChatBodyProps> = observer(
    ({ selectedProvider, userInput, setUserInput }) => {
        const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
        const [isLoading, setIsLoading] = useState(false);
        const [showFullPrompt, setShowFullPrompt] = useState(false);
        const [isEditModalVisible, setIsEditModalVisible] = useState(false);
        const inputRef = useRef<any>(null);

        // 获取当前机器人
        const selectedRobot = useMemo(() => robotStore.selectedRobot, [robotStore.selectedRobot]);

        // 使用 robotStore 的 selectedRobot 的 selectedTopicId（现在是从 robotDB 中获取的）
        const selectedTopicId = useMemo(
            () => selectedRobot?.selectedTopicId || '',
            [selectedRobot?.selectedTopicId],
        );

        // 获取当前机器人的prompt
        const currentRobotPrompt = useMemo(
            () => selectedRobot?.prompt || '',
            [selectedRobot?.prompt],
        );

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
        const { handleSendMessage: sendMessage } = useMessageSender();

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
            console.log(
                '[ChatBody] Cancel streaming response called, streamingMessageId:',
                streamingMessageId,
            );

            // 使用独立的 MessageService 来正确取消流式响应
            messageService.cancelCurrentStream(selectedTopicId);

            // cancelCurrentStream 已经设置了 streamingMessageId 为 null，不需要重复设置
            setIsLoading(false);

            console.log('[ChatBody] Cancel streaming response completed');
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

        // 当提供商设置更新时，确保使用最新的模型
        // useEffect(() => {
        //     if (selectedRobot && llmStore.defaultModel) {
        //         // 检查机器人的模型是否需要更新
        //         const currentModel = selectedRobot.model || selectedRobot.defaultModel;
        //         const defaultModel = llmStore.defaultModel;

        //         // 如果模型不同，更新机器人的模型
        //         if (
        //             currentModel?.id !== defaultModel.id ||
        //             currentModel?.provider !== defaultModel.provider
        //         ) {
        //             robotStore.updateSelectedRobot({
        //                 ...selectedRobot,
        //                 model: defaultModel,
        //             });
        //         }
        //     }
        // }, [selectedRobot, llmStore.defaultModel]);

        const handleSendMessage = () => {
            if (!userInput.trim() || isLoading) return;

            sendMessage({
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
                handleSendMessage();
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
                                    {showFullPrompt
                                        ? t('showLess') || '收起'
                                        : t('showMore') || '展开'}
                                </Button>
                            )}
                        </div>
                    </div>
                )}
                <MessageList
                    messages={displayMessages}
                    selectedProvider={selectedProvider}
                    onEditMessage={handleEditMessage}
                />
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

                <EditRobotModal
                    isVisible={isEditModalVisible}
                    onCancel={handleEditCancel}
                    editingRobot={selectedRobot}
                />
            </div>
        );
    },
);

export default ChatBody;
