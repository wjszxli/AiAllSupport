import React, { useState, useRef, FormEvent, useEffect, useCallback } from 'react';
import { Button, Input, Typography, Tooltip } from 'antd';
import {
    SendOutlined,
    ClearOutlined,
    ReloadOutlined,
    StopOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import { useChatMessages } from '../hooks/useChatMessages';
import { useLanguage } from '../contexts/LanguageContext';
import MarkdownIt from 'markdown-it';
import mathjax3 from 'markdown-it-mathjax3';
import './SidePanel.scss';
import { extractWebsiteMetadata } from '@/utils';
import { sendMessage } from '@/services/chatService';
// import MessageListAdapter from './MessageListAdapter';
// import storage from '@/utils/storage';
import {
    existWebSummarizerRobot,
    getWebSummarizerRobot,
    getWebSummarizerRobotFromDB,
} from '@/services/RobotService';
import robotDB from '@/db/robotDB';
import { Robot } from '@/types';
import { useMessageSender } from '@/chat/hooks/useMessageSender';

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
    const [robot, setRobot] = useState<Robot>();
    const { handleSendMessage } = useMessageSender();

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            setTabId(tabs[0].id?.toString() || undefined);
        });

        initRobot();
    }, []);

    const initRobot = useCallback(async () => {
        const isExistWebSummarizerRobot = await existWebSummarizerRobot();
        console.log('isExistWebSummarizerRobot', isExistWebSummarizerRobot);
        if (!isExistWebSummarizerRobot) {
            const webSummarizerRobot = getWebSummarizerRobot();
            if (webSummarizerRobot) {
                robotDB.addRobot(webSummarizerRobot);
                setRobot(webSummarizerRobot);
            }
        }
    }, []);

    // Function to handle summarize action
    const handleSummarize = useCallback(async () => {
        console.log('Handling summarize action');

        const isExistWebSummarizerRobot = await existWebSummarizerRobot();
        const webSummarizerRobot = (await robotDB.getRobotFromDB('782')) || getWebSummarizerRobot();
        if (!isExistWebSummarizerRobot && webSummarizerRobot) {
            robotDB.addRobot(webSummarizerRobot);
            setRobot(webSummarizerRobot);
        }

        const data = await extractWebsiteMetadata();
        const message = t('summarizePage').replace('{content}', JSON.stringify(data));
        console.log('message', message);
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });
        const tabId = tab?.id?.toString();
        setTabId(tabId);
        handleSendMessage({ userInput: message, robot: webSummarizerRobot });
        // await sendMessage(message, undefined, tabId);
    }, [t, setTabId, sendMessage, extractWebsiteMetadata]);

    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.data && event.data.action === 'summarize') {
                console.log('Received summarize action from parent window');
                handleSummarize();
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [handleSummarize]);

    // Listen for provider settings updates
    useEffect(() => {
        const handleProviderSettingsUpdated = (message: any) => {
            if (message.action === 'providerSettingsUpdated') {
                console.log('Provider settings updated in SidePanel');
                // storage.getSelectedProvider().then((provider) => {
                //     setSelectedProvider(provider || '');
                // });
            }
        };

        // Add listener for messages from background script
        chrome.runtime.onMessage.addListener(handleProviderSettingsUpdated);

        // Clean up listener when component unmounts
        return () => {
            chrome.runtime.onMessage.removeListener(handleProviderSettingsUpdated);
        };
    }, []);

    // const {
    //     messages,
    //     isLoading,
    //     streamingMessageId,

    //     cancelStreamingResponse,
    //     sendChatMessage,
    //     regenerateResponse,
    //     clearMessages,
    // } = useChatMessages({
    //     t,
    //     storeType: 'interface',
    //     conversationId: 'sidepanel',
    //     tabId,
    // });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isLoading) {
            sendChatMessage(inputValue);
            setInputValue('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as any);
        }
    };

    const openSettingsPage = () => {
        chrome.runtime.openOptionsPage();
    };

    // const handleClearMessages = () => {
    //     clearMessages();
    // };

    // Handle edit message from MessageList
    const handleEditMessage = useCallback((text: string) => {
        setInputValue(text);
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

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
                            // onClick={handleClearMessages}
                        />
                    </Tooltip>
                </div>
            </div>

            {/* <MessageListAdapter
                messages={messages}
                selectedProvider={selectedProvider}
                onEditMessage={handleEditMessage}
            /> */}

            <div className="chat-input-container">
                {/* {streamingMessageId !== null && (
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
                )} */}

                {/* <form onSubmit={handleSubmit} className="chat-form">
                    <TextArea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={t('typeMessage')}
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        disabled={isLoading}
                        onKeyDown={handleKeyDown}
                    />
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SendOutlined />}
                        disabled={!inputValue.trim() || isLoading}
                    />
                </form>

                <div className="action-buttons">
                    <Button type="primary" onClick={handleSummarize} className="summarize-button">
                        {t('summarize')}
                    </Button>
                </div> */}
            </div>
        </div>
    );
};

export default SidePanel;
