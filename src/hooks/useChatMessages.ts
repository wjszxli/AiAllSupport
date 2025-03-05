import { useState, useRef, useCallback, useEffect } from 'react';
import { message as messageNotification } from 'antd';
import { sendMessage, sendMessageWithWebpageContext } from '@/services/chatService';
import { useThrottledCallback } from '@/utils/reactOptimizations';
import { parseModelResponse } from '@/utils';
import { performSearch, fetchWebContent } from '@/services/localChatService';
import { LRUCache } from '@/utils/memoryOptimization';
import type { TranslationKey } from '@/contexts/LanguageContext';
import storage from '@/utils/storage';

export interface ChatMessage {
    id: number;
    text: string;
    sender: 'user' | 'ai' | 'system';
    isThinking?: boolean;
}

export const markdownCache = new LRUCache<string, string>(50);

export interface UseChatMessagesProps {
    t: (key: TranslationKey) => string;
    useWebpageContext: boolean;
}

export const useChatMessages = ({ t, useWebpageContext }: UseChatMessagesProps) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
    const [showThinking, setShowThinking] = useState(true);

    const messagesWrapperRef = useRef<HTMLDivElement>(null);
    const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const previousMessagesLengthRef = useRef(0);
    const messageIdCounter = useRef(0);

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

    // Clear thinking timeout helper
    const clearThinkingTimeout = useCallback(() => {
        if (thinkingTimeoutRef.current) {
            clearTimeout(thinkingTimeoutRef.current);
            thinkingTimeoutRef.current = null;
        }
    }, []);

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

    // Add thinking message when AI is processing
    useEffect(() => {
        if (isLoading && showThinking) {
            const thinkingMessage: ChatMessage = {
                id: messageIdCounter.current++,
                text: '',
                sender: 'ai',
                isThinking: true,
            };
            setMessages((prevMessages) => [...prevMessages, thinkingMessage]);
        }
    }, [isLoading, showThinking]);

    // Remove thinking message when response arrives or error occurs
    useEffect(() => {
        if (!isLoading) {
            setMessages((prevMessages) => prevMessages.filter((msg) => !msg.isThinking));
        }
    }, [isLoading]);

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

    // Clean up thinking timeout on unmount
    useEffect(() => {
        return () => {
            if (thinkingTimeoutRef.current) {
                clearTimeout(thinkingTimeoutRef.current);
            }
        };
    }, []);

    // Create stream update handler factory
    const createStreamUpdateHandler = useCallback(
        (aiMessageId: number) => {
            let accumulator = ''; // For accumulating content and detecting thinking content
            let hasSeenThinkingContent = false; // Flag to track if any thinking content has been seen
            let isJsonFormat = false; // Flag to track if response is in JSON format

            return (partialResponse: string) => {
                // If this is the first chunk, set streaming message ID and hide thinking indicator
                if (!streamingMessageId) {
                    setStreamingMessageId(aiMessageId);
                    setShowThinking(false);
                    clearThinkingTimeout();
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
                    // Filter out any thinking indicators
                    const filteredMessages = prevMessages.filter((msg) => !msg.isThinking);

                    const existingMessage = filteredMessages.find((msg) => msg.id === aiMessageId);

                    return existingMessage
                        ? filteredMessages.map((msg) =>
                              msg.id === aiMessageId
                                  ? {
                                        ...msg,
                                        text: messageText,
                                    }
                                  : msg,
                          )
                        : [
                              ...filteredMessages,
                              {
                                  id: aiMessageId,
                                  text: messageText,
                                  sender: 'ai',
                              },
                          ];
                });
            };
        },
        [streamingMessageId, clearThinkingTimeout],
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
        setShowThinking(false);
        clearThinkingTimeout();
    }, [clearThinkingTimeout]);

    // Send a message
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

            // Set a timeout to show thinking indicator after a short delay
            clearThinkingTimeout();
            thinkingTimeoutRef.current = setTimeout(() => {
                if (isLoading && !streamingMessageId) {
                    setShowThinking(true);
                }
            }, 300);

            try {
                // Get web search status from storage
                const webSearchEnabled = await storage.getWebSearchEnabled();
                let enhancedMessage = inputMessage;

                // If web search is enabled, perform search first
                if (webSearchEnabled) {
                    // Add a system message to notify user of search
                    const searchingMessage: ChatMessage = {
                        id: Date.now() + 1,
                        text: t('searchingWeb' as any),
                        sender: 'system',
                    };
                    setMessages((prev) => [...prev, searchingMessage]);

                    // Perform web search
                    const searchResults = await performSearch(inputMessage);

                    console.log('searchResults', searchResults);
                    // If search results exist, get webpage content
                    if (searchResults.length > 0) {
                        const contents = await Promise.all(
                            searchResults.slice(0, 2).map((result) => fetchWebContent(result.link)),
                        );

                        console.log('contents', contents);

                        // Build enhanced message with search results
                        const webContext = `${t('webSearchResultsTips1')}:${contents
                            .map(
                                (content, i) =>
                                    `${t('Source')} ${i + 1}: ${
                                        searchResults[i].title
                                    }\n${content.substring(0, 1500)}\n`,
                            )
                            .join('\n')}
${t('webSearchResultsTips2')}: ${inputMessage}
`;
                        enhancedMessage = webContext;

                        // Update system message to inform user search is complete
                        const searchCompleteMessage: ChatMessage = {
                            id: Date.now() + 2,
                            text: t('searchComplete' as any),
                            sender: 'system',
                        };
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg.id === searchingMessage.id ? searchCompleteMessage : msg,
                            ),
                        );
                    } else {
                        // If no search results, inform user
                        const noResultsMessage: ChatMessage = {
                            id: Date.now() + 2,
                            text: t('noSearchResults' as any),
                            sender: 'system',
                        };
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg.id === searchingMessage.id ? noResultsMessage : msg,
                            ),
                        );
                    }
                }

                const messageId = Date.now() + 100;
                setStreamingMessageId(messageId);

                const streamingMessage: ChatMessage = {
                    id: messageId,
                    text: '',
                    sender: 'ai',
                };

                setMessages((prev) => [...prev, streamingMessage]);

                // Create stream update handler
                const handleStreamUpdate = createStreamUpdateHandler(messageId);

                // Send message with appropriate service based on context setting
                if (useWebpageContext) {
                    await sendMessageWithWebpageContext(
                        enhancedMessage ?? '',
                        true,
                        handleStreamUpdate,
                    );
                } else {
                    await sendMessage(enhancedMessage ?? '', handleStreamUpdate);
                }

                // Request complete
                setStreamingMessageId(null);
                setIsLoading(false);
                clearThinkingTimeout();
                setShowThinking(false);
                scrollToBottom();
            } catch (error) {
                console.error('Error sending message:', error);
                messageNotification.error(t('errorProcessing'));
                setIsLoading(false);
                clearThinkingTimeout();
                setShowThinking(false);
            }
        },
        [
            isLoading,
            streamingMessageId,
            useWebpageContext,
            clearThinkingTimeout,
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

        // Filter out any thinking indicators and messages after the last user message
        setMessages(
            messages.filter((msg, index) => !msg.isThinking && index <= lastUserMessageIndex),
        );

        setIsLoading(true);

        // Set a timeout to show thinking indicator after a short delay
        clearThinkingTimeout();
        thinkingTimeoutRef.current = setTimeout(() => {
            if (isLoading && !streamingMessageId) {
                setShowThinking(true);
            }
        }, 300);

        try {
            // Create an empty AI message placeholder that will be incrementally updated
            const aiMessageId = Date.now();
            const handleStreamUpdate = createStreamUpdateHandler(aiMessageId);

            // Set streamingMessageId before starting stream
            setStreamingMessageId(aiMessageId);

            // Call appropriate API with streaming callback
            await (useWebpageContext
                ? sendMessageWithWebpageContext(lastUserMessage.text, true, handleStreamUpdate)
                : sendMessage(lastUserMessage.text, handleStreamUpdate));

            // Mark streaming response complete
            setStreamingMessageId(null);
            setIsLoading(false);
            setShowThinking(false);
            clearThinkingTimeout();
        } catch (error) {
            console.error('Error regenerating response:', error);
            setMessages((prevMessages) => {
                // Filter out any thinking indicators
                const filteredMessages = prevMessages.filter((msg) => !msg.isThinking);
                return [
                    ...filteredMessages,
                    {
                        id: Date.now(),
                        text: t('errorRegenerating'),
                        sender: 'system',
                    },
                ];
            });
            setIsLoading(false);
            setStreamingMessageId(null);
            setShowThinking(false);
            clearThinkingTimeout();
        }
    }, [
        messages,
        isLoading,
        streamingMessageId,
        t,
        useWebpageContext,
        clearThinkingTimeout,
        createStreamUpdateHandler,
    ]);

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
        showThinking,
    };
};

export default useChatMessages;
