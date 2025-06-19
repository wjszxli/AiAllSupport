import { useState, useRef, useCallback, useEffect } from 'react';
import { message as messageNotification, Modal } from 'antd';
import { sendMessage, sendMessageWithWebpageContext } from '@/services/chatService';
import { useThrottledCallback } from '@/utils/reactOptimizations';
import { LRUCache } from '@/utils/memoryOptimization';
import type { TranslationKey } from '@/contexts/LanguageContext';
import storage from '@/utils/storage';
import { localFetchWebContentWithContext } from '@/services/localChatService';
import type { ChatMessage } from '@/types';
import { updateMessage } from '@/utils/messageUtils';
import { Logger } from '@/utils/logger';

// Create a logger for this module
const logger = new Logger('useChatMessages');
import {
    saveChatAppMessages,
    getChatAppMessages,
    saveChatInterfaceMessages,
    getChatInterfaceMessages,
    deleteChatAppConversation,
    deleteChatInterfaceConversation,
} from '@/utils/indexedDBStorage';

export const markdownCache = new LRUCache<string, string>(50);

export type StoreType = 'app' | 'interface';

export interface UseChatMessagesProps {
    t: (key: TranslationKey) => string;
    storeType: StoreType;
    conversationId?: string;
    tabId?: string;
}

export const useChatMessages = ({
    t,
    storeType,
    conversationId = 'default',
    tabId,
}: UseChatMessagesProps) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const messagesWrapperRef = useRef<HTMLDivElement>(null);
    const previousMessagesLengthRef = useRef(0);

    // Load messages from IndexedDB on init
    useEffect(() => {
        const loadMessages = async () => {
            try {
                let loadedMessages: ChatMessage[] = [];
                if (storeType === 'app') {
                    loadedMessages = await getChatAppMessages(conversationId);
                } else {
                    loadedMessages = await getChatInterfaceMessages(conversationId);
                }

                if (loadedMessages && loadedMessages.length > 0) {
                    setMessages(loadedMessages);
                }
                setIsInitialized(true);
            } catch (error) {
                logger.error('Failed to load messages from IndexedDB:', error);
                setIsInitialized(true);
            }
        };

        loadMessages();
    }, [storeType, conversationId]);

    // Save messages to IndexedDB when they change
    useEffect(() => {
        if (!isInitialized) return;

        const saveMessagesToIndexedDB = async () => {
            try {
                if (storeType === 'app') {
                    await saveChatAppMessages(conversationId, messages);
                } else {
                    await saveChatInterfaceMessages(conversationId, messages);
                }
            } catch (error) {
                logger.error('Failed to save messages to IndexedDB:', error);
            }
        };

        saveMessagesToIndexedDB();
    }, [messages, storeType, conversationId, isInitialized]);

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
                // Set streaming message ID on first frame of data
                if (!streamingMessageId) {
                    setStreamingMessageId(aiMessageId);
                }

                // Ensure message text is never undefined
                const safeMessageText = messageText || '';
                const safeThinkingText = thinkingText || '';

                // Update message
                updateMessage(setMessages, aiMessageId, {
                    id: aiMessageId,
                    text: safeMessageText,
                    thinking: safeThinkingText,
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
                await sendMessage(enhancedMessage ?? '', handleStreamUpdate, tabId);

                // 请求完成
                setStreamingMessageId(null);
                setIsLoading(false);
                scrollToBottom();
            } catch (error) {
                const errorMessage = error as string;
                if (errorMessage === t('pleaseEnterApiKey')) {
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
        [messages, isLoading, streamingMessageId, t, createStreamUpdateHandler, tabId],
    );

    // 重新生成最后的AI响应
    const regenerateResponse = useCallback(async () => {
        if (messages.length < 2) return;

        const lastUserMessageIndex = messages.map((m) => m.sender).lastIndexOf('user');
        if (lastUserMessageIndex === -1) return;

        const lastUserMessage = messages[lastUserMessageIndex];

        sendChatMessage(lastUserMessage.text);
    }, [messages, isLoading, streamingMessageId, t, createStreamUpdateHandler]);

    // Function to clear messages from both state and IndexedDB
    const clearMessages = useCallback(async () => {
        try {
            // Clear messages from state
            setMessages([]);

            // Clear messages from IndexedDB based on storeType
            if (storeType === 'app') {
                await deleteChatAppConversation(conversationId);
            } else {
                await deleteChatInterfaceConversation(conversationId);
            }

            return true;
        } catch (error) {
            logger.error('Failed to clear messages:', error);
            return false;
        }
    }, [storeType, conversationId]);

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
        clearMessages,
    };
};

export default useChatMessages;
