import { Button, Card, Typography, Divider, Space, Select } from 'antd';
import React, { useEffect, useState } from 'react';
import {
    SettingOutlined,
    GithubOutlined,
    GlobalOutlined,
    MessageOutlined,
} from '@ant-design/icons';

import { t, getLocale, setLocale } from '@/locales/i18n';
import type { LocaleType } from '@/locales';
import { locales } from '@/locales';
import { GIT_URL } from '@/utils/constant';
import storage from '@/utils/storage';
import RocketIcon from '@/components/RocketIcon';

import './App.scss';

const { Option } = Select;

const App: React.FC = () => {
    const [currentLocale, setCurrentLocale] = useState<LocaleType>(getLocale());
    // const [isFadingOut, setIsFadingOut] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const savedLocale = await storage.getLocale();
                if (savedLocale && Object.keys(locales).includes(savedLocale)) {
                    await setLocale(savedLocale as LocaleType);
                    setCurrentLocale(savedLocale as LocaleType);
                }
            } catch (error) {
                console.error('Failed to initialize locale:', error);
            }
        };

        init();
    }, []);

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
            console.error('Failed to notify tabs about language change:', error);
        }
    };

    const openOptionsPage = () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    };

    const openChatPage = () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('chat.html'),
        });
    };

    return (
        <div className={`app`}>
            <Card className="app-container">
                <div className="app-header">
                    <Typography.Title level={2} className="app-title">
                        <RocketIcon size={16} /> {t('appTitle')}
                    </Typography.Title>
                    <Select
                        value={currentLocale}
                        onChange={handleLanguageChange}
                        className="language-selector"
                        popupMatchSelectWidth={false}
                        variant="outlined"
                        suffixIcon={<GlobalOutlined />}
                        style={{ width: '150px' }}
                    >
                        {(Object.keys(locales) as LocaleType[]).map((locale) => {
                            const localeWithoutHyphen = locale.replace('-', '');
                            const value =
                                localeWithoutHyphen.charAt(0).toUpperCase() +
                                localeWithoutHyphen.slice(1);
                            const key = `language${value}` as keyof typeof locales[typeof locale];
                            return (
                                <Option key={locale} value={locale}>
                                    {t(key as string)}
                                </Option>
                            );
                        })}
                    </Select>
                </div>

                <Divider />

                <div className="popup-content">
                    <Button
                        type="primary"
                        icon={<MessageOutlined />}
                        onClick={openChatPage}
                        size="large"
                        block
                    >
                        {t('openChat')}
                    </Button>
                    <Button
                        type="default"
                        icon={<SettingOutlined />}
                        onClick={openOptionsPage}
                        size="large"
                        block
                    >
                        {t('openSettings')}
                    </Button>
                    {/* <Button
                        type="default"
                        icon={<MenuUnfoldOutlined />}
                        onClick={openSidePanel}
                        size="large"
                        block
                    >
                        {t('openSidebar') || 'Summarize Current Page'}
                    </Button> */}
                </div>

                <Divider />

                <div className="app-footer">
                    <Space split={<Divider type="vertical" />}>
                        <Typography.Link href={GIT_URL} target="_blank" className="footer-link">
                            <GithubOutlined /> {t('starAuthor')}
                        </Typography.Link>
                    </Space>
                </div>
            </Card>
        </div>
    );
};

export default App;
