import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Button, Input, message as messageNotification, Typography } from 'antd';
import {
    SendOutlined,
    LinkOutlined,
    CloseOutlined,
    CopyOutlined,
    RedoOutlined,
} from '@ant-design/icons';
import './index.scss';
import './promptSuggestions.css';
import type { TranslationKey } from '@/contexts/LanguageContext';
import { useLanguage } from '@/contexts/LanguageContext';
import WebSearchToggle from '../WebSearchToggle';
import { useStableCallback } from '@/utils/reactOptimizations';
import { md } from '@/utils/markdownRenderer';
import useChatMessages, { ChatMessage, markdownCache } from '@/hooks/useChatMessages';
import { parseModelResponse } from '@/utils';

interface ChatInterfaceProps {
    initialText?: string;
}

interface MessageBubbleProps {
    message: ChatMessage;
    isStreaming: boolean;
    t: (key: TranslationKey) => string;
    copyToClipboard: (text: string) => void;
    regenerateResponse: () => void;
}

interface EmptyChatProps {
    t: (key: TranslationKey) => string;
    handleExampleClick: (text: string) => void;
}

interface ThinkingIndicatorProps {
    t: (key: TranslationKey) => string;
}

interface Prompt {
    key: string;
    name: string;
    content: string;
}

const MessageBubble = memo(
    ({ message, isStreaming, t, copyToClipboard, regenerateResponse }: MessageBubbleProps) => {
        const handleCopy = useCallback(() => {
            const { response } = parseModelResponse(message.text);
            copyToClipboard(response);
        }, [copyToClipboard, message.text, message.sender]);

        // 解析消息中的思考部分和回复部分
        const { thinking, response } = useMemo(() => {
            // 只处理AI消息
            if (message.sender === 'ai') {
                return parseModelResponse(message.text);
            }
            // 对于用户消息，不进行解析
            return { thinking: '', response: message.text };
        }, [message.text, message.sender]);

        // 渲染消息内容
        const renderMessageContent = useCallback(() => {
            if (message.sender === 'ai') {
                // 先检查是否有思考部分
                if (thinking) {
                    // 为了防止缓存混淆，生成唯一的缓存键
                    const thinkingHash =
                        thinking.length + '-' + thinking.substr(0, 20).replace(/\s/g, '');
                    const responseHash =
                        response.length + '-' + response.substr(0, 20).replace(/\s/g, '');

                    const thinkingCacheKey = `thinking-${message.id}-${thinkingHash}`;
                    const responseCacheKey = `response-${message.id}-${responseHash}`;

                    let thinkingHtml = markdownCache.get(thinkingCacheKey);
                    let responseHtml = markdownCache.get(responseCacheKey);

                    if (!thinkingHtml) {
                        const thinkingDiv = document.createElement('div');
                        thinkingDiv.innerHTML = md.render(thinking || '');
                        thinkingHtml = thinkingDiv.innerHTML;
                        markdownCache.set(thinkingCacheKey, thinkingHtml);
                    }

                    if (!responseHtml) {
                        const responseDiv = document.createElement('div');
                        responseDiv.innerHTML = md.render(response || '');
                        responseHtml = responseDiv.innerHTML;
                        markdownCache.set(responseCacheKey, responseHtml);
                    }

                    return (
                        <>
                            <div className="thinking-container">
                                <div className="thinking-header">
                                    <span className="thinking-label">
                                        {t('thinking') || '已深思熟虑'}
                                    </span>
                                </div>
                                <div
                                    className="thinking-content"
                                    dangerouslySetInnerHTML={{ __html: thinkingHtml }}
                                />
                            </div>
                            {response && (
                                <div
                                    className={`message-content ${isStreaming ? 'streaming' : ''}`}
                                    dangerouslySetInnerHTML={{ __html: responseHtml }}
                                />
                            )}
                        </>
                    );
                }

                // 没有思考部分，只渲染响应
                // 为了防止缓存混淆，使用消息长度作为键的一部分
                const messageHash =
                    message.text.length + '-' + message.text.substr(0, 20).replace(/\s/g, '');
                const cacheKey = `message-${message.id}-${messageHash}`;
                let renderedHtml = markdownCache.get(cacheKey);

                if (!renderedHtml) {
                    // 创建一个临时 div 来解析和修改 HTML 内容
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = md.render(message.text || '');
                    renderedHtml = tempDiv.innerHTML;
                    markdownCache.set(cacheKey, renderedHtml);
                }

                return (
                    <div
                        className={`message-content ${isStreaming ? 'streaming' : ''}`}
                        dangerouslySetInnerHTML={{ __html: renderedHtml }}
                    />
                );
            } else {
                return <div className="message-content">{message.text}</div>;
            }
        }, [message, isStreaming, t, thinking, response]);

        return (
            <div
                className={`message-bubble ${message.sender} ${
                    isStreaming ? 'streaming-message' : ''
                }`}
            >
                <div className="message-header">
                    <div className="sender-name">
                        {message.sender === 'user' ? t('you') : t('assistant')}
                    </div>
                </div>
                {renderMessageContent()}

                {message.sender === 'ai' && !message.isThinking && !isStreaming && (
                    <div className="message-actions-bottom">
                        <Button
                            type="text"
                            size="small"
                            onClick={handleCopy}
                            icon={<CopyOutlined />}
                            className="action-button"
                        >
                            {t('copy')}
                        </Button>
                        <Button
                            type="text"
                            size="small"
                            onClick={regenerateResponse}
                            icon={<RedoOutlined />}
                            className="action-button"
                        >
                            {t('regenerate')}
                        </Button>
                    </div>
                )}
            </div>
        );
    },
);

const EmptyChat = memo(({ t, handleExampleClick }: EmptyChatProps) => (
    <div className="empty-chat">
        <div className="emoji">💬</div>
        <Typography.Text className="title">{t('aiAssistant')}</Typography.Text>
        <Typography.Text className="message">{t('askAnything')}</Typography.Text>
        <div className="examples">
            <div className="example" onClick={() => handleExampleClick(t('exampleSummarize'))}>
                {t('exampleSummarize')}
            </div>
            <div className="example" onClick={() => handleExampleClick(t('exampleMainPoints'))}>
                {t('exampleMainPoints')}
            </div>
            <div className="example" onClick={() => handleExampleClick(t('exampleHowToUse'))}>
                {t('exampleHowToUse')}
            </div>
        </div>
    </div>
));

const ThinkingIndicator = memo(({ t }: ThinkingIndicatorProps) => (
    <div className="message-bubble ai thinking">
        <div className="message-header">
            <div className="sender-name">{t('assistant')}</div>
        </div>
        <div className="thinking-indicator">
            {t('thinking')}
            <span className="dot-animation">
                <span className="dot">.</span>
                <span className="dot">.</span>
                <span className="dot">.</span>
            </span>
        </div>
    </div>
));

const ChatInterface = ({ initialText }: ChatInterfaceProps) => {
    const [inputMessage, setInputMessage] = useState(initialText || '');
    const [useWebpageContext, setUseWebpageContext] = useState(true);
    const [isComposing, setIsComposing] = useState(false);
    const [showPrompts, setShowPrompts] = useState(false);
    const [filteredPrompts, setFilteredPrompts] = useState<Prompt[]>([]);
    const [selectedPromptIndex, setSelectedPromptIndex] = useState<number>(-1);
    const { t } = useLanguage();

    const {
        messages,
        isLoading,
        streamingMessageId,
        messagesWrapperRef,
        scrollToBottom,
        copyToClipboard,
        cancelStreamingResponse,
        sendChatMessage,
        regenerateResponse,
    } = useChatMessages({ t, useWebpageContext });

    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const isInputEmpty = useMemo(() => inputMessage.trim() === '', [inputMessage]);
    const shouldDisableButton = useMemo(
        () => isLoading || isInputEmpty || isComposing,
        [isLoading, isInputEmpty, isComposing],
    );

    // 定义常用提示
    const commonPrompts: Prompt[] = useMemo(
        () => [
            {
                key: 'translate',
                name: t('translate' as TranslationKey),
                content: t('translatePrompt' as TranslationKey),
            },
            {
                key: 'summary',
                name: t('summarize' as TranslationKey),
                content: t('summarizePrompt' as TranslationKey),
            },
            {
                key: 'explain',
                name: t('explain' as TranslationKey),
                content: t('explainPrompt' as TranslationKey),
            },
            {
                key: 'code',
                name: t('codeReview' as TranslationKey),
                content: t('codeReviewPrompt' as TranslationKey),
            },
            {
                key: 'rewrite',
                name: t('rewrite' as TranslationKey),
                content: t('rewritePrompt' as TranslationKey),
            },
        ],
        [t],
    );

    const handlePromptSelect = useCallback((prompt: Prompt) => {
        setInputMessage(prompt.content);
        setShowPrompts(false);
        setSelectedPromptIndex(-1);
    }, []);

    // 添加一个resize观察器来处理窗口调整大小
    useEffect(() => {
        // 创建一个resize观察器来处理窗口调整大小
        const resizeObserver = new ResizeObserver(() => {
            scrollToBottom();
        });

        // 观察消息包装器元素
        if (messagesWrapperRef.current) {
            resizeObserver.observe(messagesWrapperRef.current);
        }

        // 在卸载时清理观察器
        return () => {
            resizeObserver.disconnect();
        };
    }, [scrollToBottom, messagesWrapperRef]);

    // 添加复制按钮点击处理程序，并进行适当的清理
    useEffect(() => {
        const handleCopyButtonClick = async (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const copyButton = target.closest('.copy-button') as HTMLElement | null;
            if (!copyButton) return;

            event.preventDefault();
            event.stopPropagation();

            // 获取code数据属性
            const codeData = copyButton ? copyButton.getAttribute('data-code') : null;
            const code = codeData ? decodeURIComponent(codeData) : null;

            if (code) {
                console.log('code', code);
                navigator.clipboard
                    .writeText(code)
                    .then(() => {
                        messageNotification.success(t('copied'), 2);
                    })
                    .catch(() => {
                        messageNotification.error(t('failedCopy'));
                    });
            }
        };

        // 添加事件监听器
        document.addEventListener('click', handleCopyButtonClick, true);

        // 在组件卸载时清理事件监听器
        return () => {
            document.removeEventListener('click', handleCopyButtonClick, true);
        };
    }, [t]);

    const handleExampleClick = useCallback(
        (exampleText: string) => {
            // Set the input message first for visual feedback
            setInputMessage(exampleText);

            // Then send after a slight delay to ensure UI update
            setTimeout(() => {
                sendChatMessage(exampleText);
                setInputMessage('');
            }, 50);
        },
        [sendChatMessage],
    );

    const toggleWebpageContext = useCallback(() => {
        setUseWebpageContext((prev) => !prev);
    }, []);

    // 修改以处理提示放置
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setInputMessage(newValue);

        // 检查输入是否以'/'开头，并且是第一个字符或跟随一个换行符
        if (newValue === '/' || /(?:^|\n)\/$/.test(newValue)) {
            setShowPrompts(true);
            setFilteredPrompts(commonPrompts);
        }
        // 如果输入以'/'开头，后面跟着一些文本，过滤提示
        else if (newValue.startsWith('/') && !newValue.includes(' ')) {
            const searchTerm = newValue.slice(1).toLowerCase();
            setShowPrompts(true);
            setFilteredPrompts(
                commonPrompts.filter(
                    (prompt) =>
                        prompt.key.toLowerCase().includes(searchTerm) ||
                        prompt.name.toLowerCase().includes(searchTerm),
                ),
            );
        }
        // 如果输入不以'/'开头或后面跟着一个空格，隐藏提示
        else {
            setShowPrompts(false);
        }
    };

    const handleCompositionStart = () => {
        setIsComposing(true);
    };

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
        setIsComposing(false);
        // 确保在合成结束时更新输入值
        setInputMessage((e.target as HTMLTextAreaElement).value);
    };

    const handleSendMessage = useCallback(
        (e?: React.KeyboardEvent | React.MouseEvent) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }

            if (streamingMessageId) {
                cancelStreamingResponse();
                return;
            }

            sendChatMessage(inputMessage);
            setInputMessage('');
        },
        [inputMessage, streamingMessageId, cancelStreamingResponse, sendChatMessage],
    );

    // 替换keydown处理程序与稳定的回调
    const handleKeyDown = useStableCallback((e: React.KeyboardEvent) => {
        // 导航提示建议
        if (showPrompts && filteredPrompts.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedPromptIndex((prev) =>
                    prev < filteredPrompts.length - 1 ? prev + 1 : 0,
                );
                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedPromptIndex((prev) =>
                    prev > 0 ? prev - 1 : filteredPrompts.length - 1,
                );
                return;
            }

            if (e.key === 'Enter' && selectedPromptIndex >= 0) {
                e.preventDefault();
                handlePromptSelect(filteredPrompts[selectedPromptIndex]);
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                setShowPrompts(false);
                setSelectedPromptIndex(-1);
                return;
            }
        }

        // Don't trigger send during IME composition
        if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    return (
        <div className="chat-interface-container">
            {showPrompts && filteredPrompts.length > 0 ? (
                <div className="prompt-suggestions-overlay">
                    <div className="prompt-suggestions">
                        {filteredPrompts.map((prompt, index) => (
                            <div
                                key={prompt.key}
                                className={`prompt-item ${
                                    index === selectedPromptIndex ? 'selected' : ''
                                }`}
                                onClick={() => handlePromptSelect(prompt)}
                            >
                                <div className="prompt-name">{prompt.name}</div>
                                <div className="prompt-preview">
                                    {prompt.content.slice(0, 60)}...
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
            <div className="chat-controls">
                <div className="context-label" onClick={toggleWebpageContext}>
                    <span>
                        <LinkOutlined className={useWebpageContext ? 'enabled' : 'disabled'} />
                        {t('includeWebpage')}
                    </span>
                </div>
                <WebSearchToggle />
            </div>
            <div className="messages-wrapper" ref={messagesWrapperRef}>
                <div ref={messagesContainerRef} className="messages-container">
                    {messages.length === 0 ? (
                        <EmptyChat t={t} handleExampleClick={handleExampleClick} />
                    ) : (
                        messages.map((msg) => {
                            if (msg.isThinking) {
                                return <ThinkingIndicator key={msg.id} t={t} />;
                            }
                            return (
                                <MessageBubble
                                    key={msg.id}
                                    message={msg}
                                    isStreaming={streamingMessageId === msg.id}
                                    t={t}
                                    copyToClipboard={copyToClipboard}
                                    regenerateResponse={regenerateResponse}
                                />
                            );
                        })
                    )}
                </div>
            </div>
            <div className="input-container">
                <div className="input-wrapper">
                    <Input.TextArea
                        value={inputMessage}
                        onChange={handleInputChange}
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
                        onKeyDown={handleKeyDown}
                        placeholder={t('typeMessage')}
                        autoSize={{ minRows: 1, maxRows: 6 }}
                        className="message-input"
                    />
                </div>
                <Button
                    type="primary"
                    icon={streamingMessageId ? <CloseOutlined /> : <SendOutlined />}
                    onClick={handleSendMessage}
                    loading={isLoading && !streamingMessageId}
                    className={`send-button ${
                        shouldDisableButton && !streamingMessageId ? 'disabled' : 'enabled'
                    }`}
                    disabled={shouldDisableButton && !streamingMessageId}
                >
                    {streamingMessageId ? t('stop') : t('send')}
                </Button>
            </div>
        </div>
    );
};

export default ChatInterface;
