import {
    Button,
    Input,
    message,
    Select,
    Tooltip,
    Typography,
    Avatar,
    Spin,
    Empty,
    Modal,
} from 'antd';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
    GlobalOutlined,
    SettingOutlined,
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

import { t, getLocale, setLocale } from '@/services/i18n';
import type { LocaleType } from '@/locales';
import { locales } from '@/locales';
import storage from '@/utils/storage';
import { useChatMessages } from '@/hooks/useChatMessages';
import type { ChatMessage } from '@/typings';

import './App.scss';

const { Option } = Select;
const { TextArea } = Input;

const App: React.FC = () => {
    const [selectedProvider, setSelectedProvider] = useState('DeepSeek');
    const [currentLocale, setCurrentLocale] = useState<LocaleType>(getLocale());
    const [userInput, setUserInput] = useState('');
    const inputRef = useRef<any>(null);
    const [typingMessageId, setTypingMessageId] = useState<number | null>(null);

    const suggestedPrompts = useMemo(
        () => [
            t('suggestedPrompt1') || '解释一下深度学习和机器学习的区别',
            t('suggestedPrompt2') || '帮我优化一段Python代码',
            t('suggestedPrompt3') || '如何提高英语口语水平',
            t('suggestedPrompt4') || '推荐几本经典科幻小说',
        ],
        [t, currentLocale],
    );

    const {
        messages,
        setMessages,
        isLoading,
        streamingMessageId,
        messagesWrapperRef,
        copyToClipboard,
        cancelStreamingResponse,
        sendChatMessage,
        regenerateResponse,
    } = useChatMessages({ t });

    useEffect(() => {
        const init = async () => {
            try {
                const savedLocale = await storage.getLocale();
                if (savedLocale && Object.keys(locales).includes(savedLocale)) {
                    await setLocale(savedLocale as LocaleType);
                    setCurrentLocale(savedLocale as LocaleType);
                    console.log('Initialized locale from storage:', savedLocale);
                }
                const selectedProvider = await storage.getSelectedProvider();
                setSelectedProvider(selectedProvider || 'DeepSeek');
            } catch (error) {
                console.error('Failed to initialize locale:', error);
            }
        };

        init();
    }, []);

    useEffect(() => {
        const handleCopyButtonClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const copyButton = target.closest('.copy-button') as HTMLButtonElement;

            if (copyButton) {
                const encodedCode = copyButton.getAttribute('data-code');
                if (encodedCode) {
                    const code = decodeURIComponent(encodedCode);
                    navigator.clipboard
                        .writeText(code)
                        .then(() => {
                            const buttonText = copyButton.querySelector('span');
                            if (buttonText) {
                                const originalText = buttonText.textContent;
                                buttonText.textContent = t('copied');
                                setTimeout(() => {
                                    buttonText.textContent = originalText;
                                }, 2000);
                            }
                            message.success(t('copied'), 2);
                        })
                        .catch(() => {
                            message.error(t('failedCopy'));
                        });
                }
            }
        };

        document.addEventListener('click', handleCopyButtonClick);

        return () => {
            document.removeEventListener('click', handleCopyButtonClick);
        };
    }, [t]);

    useEffect(() => {
        const handleLocaleChange = (event: CustomEvent<{ locale: LocaleType }>) => {
            setCurrentLocale(event.detail.locale);
        };

        window.addEventListener('localeChange', handleLocaleChange as EventListener);

        return () => {
            window.removeEventListener('localeChange', handleLocaleChange as EventListener);
        };
    }, []);

    const handleLanguageChange = async (locale: LocaleType) => {
        await setLocale(locale);
        setCurrentLocale(locale);

        message.success(t('languageChanged'));

        try {
            if (chrome && chrome.tabs) {
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach((tab) => {
                        if (tab.id) {
                            chrome.tabs
                                .sendMessage(tab.id, { action: 'localeChanged', locale })
                                .catch(() => {});
                        }
                    });
                });
            }
        } catch (error) {
            console.log('Failed to notify tabs about language change:', error);
        }
    };

    const handleSendMessage = () => {
        // 如果正在流式传输，停止它而不是发送新消息
        if (streamingMessageId !== null) {
            cancelStreamingResponse();
            return;
        }

        // 常规发送消息逻辑
        if (userInput.trim() && !isLoading) {
            sendChatMessage(userInput.trim());
            setUserInput('');

            // 发送后聚焦输入框
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                }
            }, 0);
        }
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
            okText: t('confirm'),
            cancelText: t('cancel'),
            onOk: () => {
                setMessages([]);
                message.success(t('chatCleared'));
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

    const openOptionsPage = () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    };

    return (
        <div className="app">
            <div className="chat-container">
                <div className="chat-header">
                    <div className="chat-title">
                        <RocketOutlined /> {t('appTitle')}
                    </div>
                    <div className="header-actions">
                        <Select
                            value={currentLocale}
                            onChange={handleLanguageChange}
                            className="language-selector"
                            dropdownMatchSelectWidth={false}
                            bordered={false}
                            suffixIcon={<GlobalOutlined />}
                            style={{ width: 'auto' }}
                        >
                            {(Object.keys(locales) as LocaleType[]).map((locale) => {
                                const localeWithoutHyphen = locale.replace('-', '');
                                const value =
                                    localeWithoutHyphen.charAt(0).toUpperCase() +
                                    localeWithoutHyphen.slice(1);
                                const key =
                                    `language${value}` as keyof typeof locales[typeof locale];
                                return (
                                    <Option key={locale} value={locale}>
                                        {t(key as string)}
                                    </Option>
                                );
                            })}
                        </Select>
                        <Button
                            type="text"
                            icon={<SettingOutlined />}
                            onClick={openOptionsPage}
                            className="settings-button"
                        />
                    </div>
                </div>

                <div className="chat-body">
                    <div className="messages-container" ref={messagesWrapperRef}>
                        {messages.length === 0 ? (
                            <div className="welcome-container">
                                <Empty
                                    image={
                                        <RocketOutlined
                                            style={{ fontSize: '64px', color: '#1890ff' }}
                                        />
                                    }
                                    description={
                                        <Typography.Text strong>
                                            {t('welcomeMessage')}
                                        </Typography.Text>
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
                                    } ${
                                        typingMessageId === msg.id || streamingMessageId === msg.id
                                            ? 'typing'
                                            : ''
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
                                                {msg.sender === 'user'
                                                    ? t('you')
                                                    : selectedProvider}
                                                <span className="message-time">
                                                    {new Date(msg.id).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="message-text">
                                            {renderMessageContent(msg)}
                                        </div>
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
                                            streamingMessageId !== null
                                                ? 'stop-button'
                                                : 'send-button'
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
            </div>
        </div>
    );
};

export default App;
