import { Button, Card, Typography, Divider, Space, Select } from 'antd';
import React, { useEffect, useState } from 'react';
import {
    SettingOutlined,
    GithubOutlined,
    RocketOutlined,
    GlobalOutlined,
    MessageOutlined,
    MenuUnfoldOutlined,
} from '@ant-design/icons';

import { t, getLocale, setLocale } from '@/locales/i18n';
import type { LocaleType } from '@/locales';
import { locales } from '@/locales';
import { GIT_URL } from '@/utils/constant';
import storage from '@/utils/storage';

import './App.scss';

const { Option } = Select;

const App: React.FC = () => {
    const [currentLocale, setCurrentLocale] = useState<LocaleType>(getLocale());
    const [isFadingOut, setIsFadingOut] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const savedLocale = await storage.getLocale();
                if (savedLocale && Object.keys(locales).includes(savedLocale)) {
                    await setLocale(savedLocale as LocaleType);
                    setCurrentLocale(savedLocale as LocaleType);
                    console.log('Initialized locale from storage:', savedLocale);
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
            console.log('Failed to notify tabs about language change:', error);
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

    const openSidePanel = () => {
        // 向当前活动标签页发送消息，要求总结当前页面
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                console.log('Sending summarizeCurrentPage message to tab', tabs[0].id);
                chrome.tabs
                    .sendMessage(tabs[0].id, { action: 'summarizeCurrentPage' })
                    .then(() => {
                        // Add smooth fade-out animation before closing
                        setIsFadingOut(true);
                        setTimeout(() => {
                            window.close();
                        }, 300); // Wait for animation to complete
                    })
                    .catch((error) => {
                        console.error('Failed to send summarizeCurrentPage message:', error);
                        // 如果消息发送失败，可能内容脚本未加载，尝试使用原生侧边栏
                        tryNativeSidePanel();
                    });
            }
        });
    };

    // 尝试使用原生侧边栏
    const tryNativeSidePanel = () => {
        chrome.windows.getCurrent({ populate: true }, (chromeWindow) => {
            if (chromeWindow.id) {
                chrome.sidePanel.setOptions({
                    enabled: true,
                });
                chrome.sidePanel
                    .open({ windowId: chromeWindow.id })
                    .then(() => {
                        // Add smooth fade-out animation before closing
                        setIsFadingOut(true);
                        setTimeout(() => {
                            window.close();
                        }, 300); // Wait for animation to complete
                    })
                    .catch((error) => {
                        console.error('Failed to open side panel:', error);
                        // 回退到 iframe 解决方案
                        createIframeSidePanel();
                    });
            }
        });
    };

    // 创建基于 iframe 的替代侧边栏
    const createIframeSidePanel = () => {
        // 向当前活动标签页发送消息，要求创建 iframe 侧边栏
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs
                    .sendMessage(tabs[0].id, { action: 'createIframeSidePanel' })
                    .then(() => {
                        // Add smooth fade-out animation before closing
                        setIsFadingOut(true);
                        setTimeout(() => {
                            window.close();
                        }, 300); // Wait for animation to complete
                    })
                    .catch((error) => {
                        console.error('Failed to send iframe side panel creation message:', error);
                        // 如果消息发送失败，可能内容脚本未加载，直接创建一个新标签页作为替代
                        openSidePanelInNewTab();
                    });
            }
        });
    };

    // 在新标签页中打开侧边栏
    const openSidePanelInNewTab = () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('sidepanel.html?action=summarize'),
        });
    };

    return (
        <div className={`app ${isFadingOut ? 'fade-out' : ''}`}>
            <Card className="app-container">
                <div className="app-header">
                    <Typography.Title level={2} className="app-title">
                        <RocketOutlined /> {t('appTitle')}
                    </Typography.Title>
                    <Select
                        value={currentLocale}
                        onChange={handleLanguageChange}
                        className="language-selector"
                        dropdownMatchSelectWidth={false}
                        bordered={true}
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
                    <Button
                        type="default"
                        icon={<MenuUnfoldOutlined />}
                        onClick={openSidePanel}
                        size="large"
                        block
                    >
                        {t('openSidebar') || 'Summarize Current Page'}
                    </Button>
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
