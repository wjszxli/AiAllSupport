import React, { useState, useRef, FormEvent, useEffect } from 'react';
import { Button, Input, Spin, Typography, Tooltip } from 'antd';
import {
    SendOutlined,
    ClearOutlined,
    ReloadOutlined,
    StopOutlined,
    CopyOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import { useChatMessages } from '../hooks/useChatMessages';
import { useLanguage } from '../contexts/LanguageContext';
import MarkdownIt from 'markdown-it';
import mathjax3 from 'markdown-it-mathjax3';
import './SidePanel.scss';
import { extractWebsiteMetadata } from '@/utils';
import { sendMessage } from '@/services/chatService';

const { TextArea } = Input;
const { Text } = Typography;

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
});

md.use(mathjax3);

const SidePanel: React.FC = () => {
    const { t } = useLanguage();
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [tabId, setTabId] = useState<string | undefined>(undefined);

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            setTabId(tabs[0].id?.toString() || undefined);
        });
    }, []);

    const {
        messages,
        isLoading,
        streamingMessageId,
        messagesWrapperRef,
        copyToClipboard,
        cancelStreamingResponse,
        sendChatMessage,
        regenerateResponse,
        clearMessages,
    } = useChatMessages({
        t,
        storeType: 'interface',
        conversationId: 'sidepanel',
        tabId,
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isLoading) {
            sendChatMessage(inputValue);
            setInputValue('');
        }
    };

    const renderMarkdown = (content: string) => {
        try {
            return md.render(content || '');
        } catch (error) {
            console.error('Error rendering markdown:', error);
            return content || '';
        }
    };

    const openSettingsPage = () => {
        chrome.runtime.openOptionsPage();
    };

    const handleClearMessages = () => {
        clearMessages();
    };
    console.log('messages', messages)

    return (
        <div className="side-panel">
            <div className="chat-header">
                <Text strong>{t('chatWithAI')}</Text>
                <div>
                    <Tooltip title={t('settings') || 'Settings'}>
                        <Button
                            type="text"
                            size="small"
                            icon={<SettingOutlined />}
                            onClick={openSettingsPage}
                            style={{ marginRight: '4px' }}
                        />
                    </Tooltip>
                    <Tooltip title={t('clearChat')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<ClearOutlined />}
                            onClick={handleClearMessages}
                        />
                    </Tooltip>
                </div>
            </div>

            <div className="chat-messages" ref={messagesWrapperRef}>
                {messages.length === 0 ? (
                    <div className="empty-chat-message">
                        <Text type="secondary">{t('startChat')}</Text>
                    </div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={`message ${
                                message.sender === 'user' ? 'user-message' : 'ai-message'
                            }`}
                        >
                            <div className="message-header">
                                <Text strong>{message.sender === 'user' ? t('you') : t('ai')}</Text>
                                {message.sender === 'ai' && (
                                    <div className="message-actions">
                                        <Tooltip title={t('copy')}>
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<CopyOutlined />}
                                                onClick={() => copyToClipboard(message.text)}
                                            />
                                        </Tooltip>
                                    </div>
                                )}
                            </div>
                            <div className="message-content">
                                {message.sender === 'user' ? (
                                    <Text>{message.text}</Text>
                                ) : (
                                    <div
                                        className="markdown-content"
                                        dangerouslySetInnerHTML={{
                                            __html: renderMarkdown(message.text),
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    ))
                )}
                {isLoading && streamingMessageId === null && (
                    <div className="loading-indicator">
                        <Spin size="small" />
                        <Text type="secondary">{t('thinking')}</Text>
                    </div>
                )}
            </div>

            <div className="chat-input-container">
                {streamingMessageId !== null && (
                    <Button
                        className="stop-button"
                        type="default"
                        icon={<StopOutlined />}
                        onClick={cancelStreamingResponse}
                    >
                        {t('stop')}
                    </Button>
                )}

                {!isLoading && messages.length > 0 && (
                    <Button
                        className="regenerate-button"
                        type="default"
                        icon={<ReloadOutlined />}
                        onClick={regenerateResponse}
                    >
                        {t('regenerate')}
                    </Button>
                )}

                <form onSubmit={handleSubmit} className="chat-form">
                    <TextArea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={t('typeMessage')}
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        disabled={isLoading}
                        onPressEnter={(e) => {
                            if (!e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                    />
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SendOutlined />}
                        disabled={!inputValue.trim() || isLoading}
                    />
                </form>
                <Button
                    type="primary"
                    onClick={async () => {
                        const data = await extractWebsiteMetadata();
                        const message = t('summarizePage').replace(
                            '{content}',
                            JSON.stringify(data),
                        );
                        const [tab] = await chrome.tabs.query({
                            active: true,
                            currentWindow: true,
                        });
                        const tabId = tab?.id?.toString();
                        setTabId(tabId);
                        await sendMessage(message, undefined, tabId);
                    }}
                >
                    {t('summarize')}
                </Button>
            </div>
        </div>
    );
};

export default SidePanel;
