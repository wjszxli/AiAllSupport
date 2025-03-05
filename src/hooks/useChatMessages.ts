import { useState, useRef, useCallback, useEffect } from 'react';
import { message as messageNotification } from 'antd';
import { sendMessage, sendMessageWithWebpageContext } from '@/services/chatService';
import { useThrottledCallback } from '@/utils/reactOptimizations';
import { parseModelChunk, createInitialParsingState, type ParsingState } from '@/utils';
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

    // 在适当的地方添加解析状态
    const [parsingState, setParsingState] = useState<ParsingState>(createInitialParsingState());

    // Create stream update handler factory
    const createStreamUpdateHandler = useCallback(
        (aiMessageId: number) => {
            let accumulator = ''; // 用于累积内容和检测思考内容
            let hasSeenThinkingContent = false; // 标志，用于跟踪是否看到任何思考内容
            let messageText = '';

            return (partialResponse: string) => {
                // 第一帧数据，设置数据 ID
                if (!streamingMessageId) {
                    setStreamingMessageId(aiMessageId);
                }

                // 处理新的数据块
                const newState = parseModelChunk(partialResponse, parsingState);
                setParsingState(newState);

                // 仍然保留累加器用于后备和兼容
                accumulator += partialResponse;

                // 检查是否有思考内容
                if (!hasSeenThinkingContent && (newState.thinking || newState.isInThinkTag)) {
                    hasSeenThinkingContent = true;
                }

                // 使用新的解析状态来构建消息
                try {
                    if (newState.thinking) {
                        hasSeenThinkingContent = true;

                        // 对于 JSON 格式，我们重建消息
                        if (newState.jsonMode) {
                            // 创建一个 JSON 对象
                            messageText += JSON.stringify({
                                reasoning_content: newState.thinking,
                                content: newState.response,
                            });
                        } else {
                            // 对于 <think> 标签格式
                            messageText += `<think>${newState.thinking}</think>\n\n${newState.response}`;
                        }
                    } else {
                        // 没有检测到思考内容
                        messageText += newState.jsonMode
                            ? newState.partialJson || accumulator // 使用部分JSON或累加器
                            : newState.response; // 使用已解析的响应
                    }
                } catch (error) {
                    // 如果发生任何错误，直接使用累加器
                    console.error('Error in chunk parsing:', error);
                    messageText = accumulator;
                }

                console.log('messageText', messageText);

                // 更新消息
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
        [streamingMessageId, parsingState],
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
                console.error('Error sending message:', error);
                messageNotification.error(t('errorProcessing'));
                setIsLoading(false);
            }
        },
        [messages, isLoading, streamingMessageId, t, createStreamUpdateHandler],
    );

    // Regenerate last AI response
    const regenerateResponse = useCallback(async () => {
        if (messages.length < 2) return;

        const useWebpageContext = await storage.getUseWebpageContext();

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
