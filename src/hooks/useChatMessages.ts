import { useState, useRef, useCallback, useEffect } from 'react';
import { message as messageNotification } from 'antd';
import { sendMessage, sendMessageWithWebpageContext } from '@/services/chatService';
import { useThrottledCallback } from '@/utils/reactOptimizations';
import { parseModelResponse } from '@/utils';
import { LRUCache } from '@/utils/memoryOptimization';
import type { TranslationKey } from '@/contexts/LanguageContext';
import storage from '@/utils/storage';
import { localFetchWebContentWithContext } from '@/services/localChatService';
import type { ChatMessage } from '@/typings';
import { updateMessage } from '@/utils/messageUtils';

export const markdownCache = new LRUCache<string, string>(50);

export interface UseChatMessagesProps {
    t: (key: TranslationKey) => string;
    useWebpageContext: boolean;
}

export const useChatMessages = ({ t, useWebpageContext }: UseChatMessagesProps) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);

    const messagesWrapperRef = useRef<HTMLDivElement>(null);
    const previousMessagesLengthRef = useRef(0);

    // Scroll to bottom functionality
    const scrollToBottom = useThrottledCallback(
        () => {
            if (messagesWrapperRef.current) {
                messagesWrapperRef.current.scrollTop = messagesWrapperRef.current.scrollHeight;
            }
        },
        100,
        [],
    );

    // Copy to clipboard functionality
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

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messages.length !== previousMessagesLengthRef.current) {
            scrollToBottom();
            previousMessagesLengthRef.current = messages.length;
        }
    }, [messages.length, scrollToBottom]);

    // Scroll to bottom during streaming updates
    useEffect(() => {
        if (streamingMessageId) {
            scrollToBottom();
        }
    }, [streamingMessageId, scrollToBottom]);

    // Create stream update handler factory
    const createStreamUpdateHandler = useCallback(
        (aiMessageId: number) => {
            let accumulator = ''; // For accumulating content and detecting thinking content
            let hasSeenThinkingContent = false; // Flag to track if any thinking content has been seen
            let isJsonFormat = false; // Flag to track if response is in JSON format

            return (partialResponse: string) => {
                // If this is the first chunk, set streaming message ID
                if (!streamingMessageId) {
                    setStreamingMessageId(aiMessageId);
                }

                // Add new chunk to our accumulator
                accumulator += partialResponse;

                // Check if this might be a JSON response with reasoning_content
                if (!isJsonFormat && accumulator.trim().startsWith('{')) {
                    isJsonFormat = true;
                }

                // Check if this might be a chunk containing any thinking indicators
                if (!hasSeenThinkingContent) {
                    if (isJsonFormat && accumulator.includes('reasoning_content')) {
                        hasSeenThinkingContent = true;
                    } else if (
                        accumulator.includes('<think>') ||
                        accumulator.includes('</think>')
                    ) {
                        hasSeenThinkingContent = true;
                    }
                }

                let messageText = '';

                // Process accumulated content
                try {
                    // Parse content using our utility function
                    const parsed = parseModelResponse(accumulator);

                    if (parsed.thinking) {
                        hasSeenThinkingContent = true;

                        // For JSON format, we rebuild the message
                        if (isJsonFormat) {
                            // Create a JSON object, which will be parsed again by parseModelResponse
                            messageText = JSON.stringify({
                                reasoning_content: parsed.thinking,
                                content: parsed.response,
                            });
                        } else {
                            // For <think> tag format, wrap thinking content in tags
                            messageText = `<think>${parsed.thinking}</think>\n\n${parsed.response}`;
                        }
                    } else {
                        // No thinking content detected
                        messageText = isJsonFormat
                            ? accumulator // Keep original JSON
                            : parsed.response; // Use processed response
                    }
                } catch (error) {
                    // If any error occurs, just use the original accumulator
                    console.error('Error processing response:', error);
                    messageText = accumulator;
                }

                // Update the message
                setMessages((prevMessages) => {
                    const existingMessage = prevMessages.find((msg) => msg.id === aiMessageId);

                    return existingMessage
                        ? prevMessages.map((msg) =>
                              msg.id === aiMessageId
                                  ? {
                                        ...msg,
                                        text: messageText,
                                    }
                                  : msg,
                          )
                        : [
                              ...prevMessages,
                              {
                                  id: aiMessageId,
                                  text: messageText,
                                  sender: 'ai',
                              },
                          ];
                });
            };
        },
        [streamingMessageId],
    );

    // Cancel an ongoing streaming response
    const cancelStreamingResponse = useCallback(() => {
        // Use global abort controller to cancel API request
        if (window.currentAbortController) {
            window.currentAbortController.abort();
        }

        // Update UI state
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
                const webSearchEnabled = await storage.getWebSearchEnabled();
                let enhancedMessage = inputMessage;

                if (useWebpageContext) {
                    // 根据当前网页设置发送消息
                    enhancedMessage = await sendMessageWithWebpageContext(
                        messageId,
                        enhancedMessage ?? '',
                        setMessages,
                    );
                 console.log('messages', messages)
                } else if (webSearchEnabled) {
                    // 联网搜索
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
                console.error('Error sending message:', error);
                messageNotification.error(t('errorProcessing'));
                setIsLoading(false);
            }
        },
        [
            isLoading,
            streamingMessageId,
            useWebpageContext,
            createStreamUpdateHandler,
            scrollToBottom,
            t,
        ],
    );

    // Regenerate last AI response
    const regenerateResponse = useCallback(async () => {
        if (messages.length < 2) return;

        const lastUserMessageIndex = messages.map((m) => m.sender).lastIndexOf('user');
        if (lastUserMessageIndex === -1) return;

        const lastUserMessage = messages[lastUserMessageIndex];

        // Filter out any messages after the last user message
        setMessages(messages.filter((_, index) => index <= lastUserMessageIndex));

        setIsLoading(true);

        try {
            // Create an empty AI message placeholder that will be incrementally updated
            const aiMessageId = Date.now();
            const handleStreamUpdate = createStreamUpdateHandler(aiMessageId);

            // Set streamingMessageId before starting stream
            setStreamingMessageId(aiMessageId);

            // Call appropriate API with streaming callback
            await (useWebpageContext
                ? sendMessageWithWebpageContext(aiMessageId, lastUserMessage.text, setMessages)
                : sendMessage(lastUserMessage.text, handleStreamUpdate));

            // Mark streaming response complete
            setStreamingMessageId(null);
            setIsLoading(false);
        } catch (error) {
            console.error('Error regenerating response:', error);
            setMessages((prevMessages) => {
                return [
                    ...prevMessages,
                    {
                        id: Date.now(),
                        text: t('errorRegenerating'),
                        sender: 'system',
                    },
                ];
            });
            setIsLoading(false);
            setStreamingMessageId(null);
        }
    }, [messages, isLoading, streamingMessageId, t, useWebpageContext, createStreamUpdateHandler]);

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
