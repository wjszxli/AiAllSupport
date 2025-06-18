import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Typography, Tooltip } from 'antd';
import { ClearOutlined, SettingOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import MarkdownIt from 'markdown-it';
import mathjax3 from 'markdown-it-mathjax3';
import './SidePanel.scss';
import { extractWebsiteMetadata } from '@/utils';
import { sendMessage } from '@/services/chatService';
import { existWebSummarizerRobot, getWebSummarizerRobot } from '@/services/RobotService';
import robotDB from '@/db/robotDB';
import { Robot } from '@/types';
import { useMessageSender } from '@/chat/hooks/useMessageSender';
import rootStore from '@/store';

const { Text } = Typography;

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
});

md.use(mathjax3);

const SidePanel: React.FC = () => {
    const { t } = useLanguage();
    const [tabId, setTabId] = useState<string | undefined>(undefined);
    const [robot, setRobot] = useState<Robot>();
    const { handleSendMessage } = useMessageSender();
    console.log('tabId', tabId);

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
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });
        const tabId = tab?.id?.toString();
        setTabId(tabId);
        handleSendMessage({ userInput: message, robot: webSummarizerRobot });
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

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            setTabId(tabs[0].id?.toString() || undefined);
        });

        const handleProviderSettingsUpdated = (message: any) => {
            if (message.action === 'providerSettingsUpdated') {
                console.log('Provider settings updated in SidePanel');
                // storage.getSelectedProvider().then((provider) => {
                //     setSelectedProvider(provider || '');
                // });
            }
        };

        chrome.runtime.onMessage.addListener(handleProviderSettingsUpdated);

        return () => {
            chrome.runtime.onMessage.removeListener(handleProviderSettingsUpdated);
        };
    }, []);

    const { messageStore, messageBlockStore } = rootStore;

    const messages = useMemo(() => {
        const data = messageStore.getMessagesForTopic(robot?.selectedTopicId || '');
        return data;
    }, [robot?.selectedTopicId, messageStore.messages.size, messageBlockStore.blocks.size]);

    console.log('messages', messages);

    const openSettingsPage = () => {
        chrome.runtime.openOptionsPage();
    };

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
