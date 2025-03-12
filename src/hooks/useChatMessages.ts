import { useState, useRef, useCallback, useEffect } from 'react';
import { message as messageNotification, Modal } from 'antd';
import { sendMessage, sendMessageWithWebpageContext } from '@/services/chatService';
import { useThrottledCallback } from '@/utils/reactOptimizations';
import { LRUCache } from '@/utils/memoryOptimization';
import type { TranslationKey } from '@/contexts/LanguageContext';
import storage from '@/utils/storage';
import { localFetchWebContentWithContext } from '@/services/localChatService';
import type { ChatMessage } from '@/typings';
import { updateMessage } from '@/utils/messageUtils';

export const markdownCache = new LRUCache<string, string>(50);

export interface UseChatMessagesProps {
    t: (key: TranslationKey) => string;
}

export const useChatMessages = ({ t }: UseChatMessagesProps) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);

    const messagesWrapperRef = useRef<HTMLDivElement>(null);
    const previousMessagesLengthRef = useRef(0);

    const scrollToBottom = useThrottledCallback(
        () => {
            if (messagesWrapperRef.current) {
                messagesWrapperRef.current.scrollTop = messagesWrapperRef.current.scrollHeight;
            }
        },
        100,
        [],
    );

    const copyToClipboard = useCallback(
        (text: string) => {
            navigator.clipboard
                .writeText(text)
                .then(() => {
                    messageNotification.success(t('copied'), 2);
                })
                .catch(() => {
                    messageNotification.error(t('failedCopy'));
                });
        },
        [t],
    );

    useEffect(() => {
        if (messages.length !== previousMessagesLengthRef.current) {
            scrollToBottom();
            previousMessagesLengthRef.current = messages.length;
        }

        if (streamingMessageId) {
            scrollToBottom();
        }
    }, [messages.length, scrollToBottom, streamingMessageId]);

    const createStreamUpdateHandler = useCallback(
        (aiMessageId: number) => {
            return (messageText: string, thinkingText: string) => {
                // 第一帧数据，设置数据 ID
                if (!streamingMessageId) {
                    setStreamingMessageId(aiMessageId);
                }

                // 更新消息
                updateMessage(setMessages, aiMessageId, {
                    id: aiMessageId,
                    text: messageText,
                    thinking: thinkingText,
                    sender: 'ai',
                });
            };
        },
        [streamingMessageId],
    );

    const cancelStreamingResponse = useCallback(() => {
        if (window.currentAbortController) {
            window.currentAbortController.abort();
        }

        setStreamingMessageId(null);
        setIsLoading(false);
    }, []);

    const sendChatMessage = useCallback(
        async (inputMessage: string) => {
            if (!inputMessage.trim()) return;

            const userMessage: ChatMessage = {
                id: Date.now(),
                text: inputMessage,
                sender: 'user',
            };

            setMessages((prev) => [...prev, userMessage]);
            setIsLoading(true);

            // 生成数据 id
            const messageId = Date.now() + 100;

            try {
                // 获取当前配置
                const [webSearchEnabled, useWebpageContext] = await Promise.all([
                    storage.getWebSearchEnabled(),
                    storage.getUseWebpageContext(),
                ]);

                let enhancedMessage = inputMessage;

                if (useWebpageContext) {
                    enhancedMessage = await sendMessageWithWebpageContext(
                        messageId,
                        enhancedMessage ?? '',
                        setMessages,
                    );
                } else if (webSearchEnabled) {
                    enhancedMessage = await localFetchWebContentWithContext(
                        messageId,
                        inputMessage,
                        enhancedMessage,
                        setMessages,
                    );
                }

                const thinkingMessage: ChatMessage = {
                    id: messageId,
                    text: t('thinking'),
                    sender: 'ai',
                };

                updateMessage(setMessages, messageId, thinkingMessage);

                setStreamingMessageId(messageId);
                // 响应数据流
                const handleStreamUpdate = createStreamUpdateHandler(messageId);
                await sendMessage(enhancedMessage ?? '', handleStreamUpdate);

                // 请求完成
                setStreamingMessageId(null);
                setIsLoading(false);
                scrollToBottom();
            } catch (error) {
                const errorMessage = error as string;
                if (errorMessage === t("pleaseEnterApiKey")) {
                    Modal.confirm({
                        title: t('pleaseEnterApiKey'),
                        content: t('apiKeyNeeded'),
                        okText: t('ok'),
                        cancelText: t('cancel'),
                        onOk: () => {
                            if (chrome.runtime.openOptionsPage) {
                                chrome.runtime.openOptionsPage();
                            } else {
                                window.open(chrome.runtime.getURL('options.html'));
                            }
                        },
                    });
                } else {
                    messageNotification.error(errorMessage);
                }
                setIsLoading(false);
            }
        },
        [messages, isLoading, streamingMessageId, t, createStreamUpdateHandler],
    );

    // 重新生成最后的AI响应
    const regenerateResponse = useCallback(async () => {
        if (messages.length < 2) return;

        const lastUserMessageIndex = messages.map((m) => m.sender).lastIndexOf('user');
        if (lastUserMessageIndex === -1) return;

        const lastUserMessage = messages[lastUserMessageIndex];

        sendChatMessage(lastUserMessage.text);
    }, [messages, isLoading, streamingMessageId, t, createStreamUpdateHandler]);

    return {
        messages,
        setMessages,
        isLoading,
        streamingMessageId,
        messagesWrapperRef,
        scrollToBottom,
        copyToClipboard,
        cancelStreamingResponse,
        sendChatMessage,
        regenerateResponse,
    };
};

export default useChatMessages;
