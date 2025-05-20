import {
    ApiOutlined,
    BugOutlined,
    ControlOutlined,
    GlobalOutlined,
    InfoCircleOutlined,
    RocketOutlined,
    SearchOutlined,
} from '@ant-design/icons';
import { Card, Divider, Form, Layout, message, Select, Tabs, Typography } from 'antd';
import React, { useEffect, useState } from 'react';

import type { LocaleType } from '@/locales';
import { locales } from '@/locales';
import { getLocale, setLocale, t } from '@/services/i18n';
import { FEEDBACK_SURVEY_URL, isFirefox, SHORTCUTS_URL } from '@/utils/constant';
import storage from '@/utils/storage';

import About from './components/About';
import ApiSettings from './components/ApiSettings';
import Footer from './components/Footer';
import Interface from './components/Interface';
import Logger from './components/Logger';
import Search from './components/Search';

import './App.scss';

const { Option } = Select;
const { TabPane } = Tabs;
const { Content } = Layout;

const App: React.FC = () => {
    const [form] = Form.useForm();
    const [currentLocale, setCurrentLocale] = useState<LocaleType>(getLocale());
    const [activeTab, setActiveTab] = useState('api');

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
            form.setFieldsValue(form.getFieldsValue());
        };

        window.addEventListener('localeChange', handleLocaleChange as EventListener);

        return () => {
            window.removeEventListener('localeChange', handleLocaleChange as EventListener);
        };
    }, [form]);

    // 更新页面标题
    useEffect(() => {
        document.title = `${t('appTitle')} - ${t('settings')}`;
    }, [currentLocale, t]);

    const handleLanguageChange = async (locale: LocaleType) => {
        await setLocale(locale);
        setCurrentLocale(locale);

        message.success(t('languageChanged'));

        setTimeout(() => {
            form.setFieldsValue(form.getFieldsValue());
        }, 50);

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

    const onSetShortcuts = () => {
        chrome.tabs.create({
            url: SHORTCUTS_URL,
        });

        if (isFirefox) {
            // Firefox needs additional steps to access shortcut settings
            message.info(
                'After the Firefox extension page opens, please click on "⚙️ Manage Your Extensions" on the left, then select "⌨️ Manage Extension Shortcuts"',
                8,
            );
        }
    };

    // Function to open feedback form
    const openFeedbackSurvey = () => {
        window.open(FEEDBACK_SURVEY_URL, '_blank');
    };

    // Main render method
    return (
        <Layout className="app">
            <Layout className="app-layout">
                <div className="app-header">
                    <Typography.Title level={2} className="app-title">
                        <RocketOutlined /> {t('appTitle')} - {t('settings')}
                    </Typography.Title>
                    <Select
                        value={currentLocale}
                        onChange={handleLanguageChange}
                        className="language-selector"
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
                <Content className="app-content">
                    <Card className="settings-card">
                        <Tabs
                            activeKey={activeTab}
                            onChange={setActiveTab}
                            tabPosition="left"
                            className="settings-tabs"
                        >
                            <TabPane
                                tab={
                                    <span>
                                        <ApiOutlined /> {t('apiSettings')}
                                    </span>
                                }
                                key="api"
                            >
                                <ApiSettings />
                            </TabPane>
                            <TabPane
                                tab={
                                    <span>
                                        <ControlOutlined /> {t('interface')}
                                    </span>
                                }
                                key="interface"
                            >
                                <Interface form={form} />
                            </TabPane>

                            <TabPane
                                tab={
                                    <span>
                                        <SearchOutlined /> {t('search')}
                                    </span>
                                }
                                key="search"
                            >
                                <Search
                                    form={form}
                                    onValuesChange={(changedValues, allValues) => {
                                        console.log(
                                            'Search form values changed:',
                                            changedValues,
                                            allValues,
                                        );
                                    }}
                                />
                            </TabPane>

                            <TabPane
                                tab={
                                    <span>
                                        <BugOutlined /> {t('options_logging_settings')}
                                    </span>
                                }
                                key="logging"
                            >
                                <Logger />
                            </TabPane>

                            <TabPane
                                tab={
                                    <span>
                                        <InfoCircleOutlined /> {t('about')}
                                    </span>
                                }
                                key="about"
                            >
                                <About
                                    onSetShortcuts={onSetShortcuts}
                                    openFeedbackSurvey={openFeedbackSurvey}
                                />
                            </TabPane>
                        </Tabs>
                    </Card>
                </Content>
                <Footer onSetShortcuts={onSetShortcuts} openFeedbackSurvey={openFeedbackSurvey} />
            </Layout>
        </Layout>
    );
};

export default App;
