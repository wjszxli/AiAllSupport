import {
    ApiOutlined,
    ControlOutlined,
    GlobalOutlined,
    InfoCircleOutlined,
    RocketOutlined,
    SearchOutlined,
    AppstoreOutlined,
    QuestionCircleOutlined,
} from '@ant-design/icons';
import {
    Card,
    Divider,
    Form,
    Layout,
    message,
    Select,
    Tabs,
    Typography,
    Tour,
    Button,
    TourProps,
} from 'antd';
import React, { useEffect, useState, useRef } from 'react';

import type { LocaleType } from '@/locales';
import { locales } from '@/locales';
import { getLocale, setLocale, t } from '@/locales/i18n';
import { FEEDBACK_SURVEY_URL, isFirefox, SHORTCUTS_URL } from '@/utils/constant';
import storage from '@/utils/storage';

import About from './components/About';
import ApiSettings, { ApiSettingsRef } from './components/ApiSettings';
import Footer from './components/Footer';
import Interface from './components/Interface';
import Search from './components/Search';
import ModelSettings from './components/ModelSettings';

import './App.scss';

const { Option } = Select;
const { TabPane } = Tabs;
const { Content } = Layout;

const App: React.FC = () => {
    const [form] = Form.useForm();
    const [currentLocale, setCurrentLocale] = useState<LocaleType>(getLocale());
    const [activeTab, setActiveTab] = useState('api');

    // Tour 相关状态
    const [tourOpen, setTourOpen] = useState(false);
    const apiTabRef = useRef<HTMLDivElement>(null);
    const modelTabRef = useRef<HTMLDivElement>(null);
    const interfaceTabRef = useRef<HTMLDivElement>(null);
    const searchTabRef = useRef<HTMLDivElement>(null);
    const tourButtonRef = useRef<HTMLButtonElement>(null);

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
            console.error('Failed to notify tabs about language change:', error);
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

    // 添加 ApiSettings 的 ref
    const apiSettingsRef = useRef<ApiSettingsRef>(null);

    // Tour 步骤配置
    // 添加Tour当前步骤状态
    const [tourCurrent, setTourCurrent] = useState(0);

    // 修改Tour步骤配置
    const tourSteps: TourProps['steps'] = [
        {
            title: t('tourWelcome'),
            description: t('tourWelcomeDesc'),
            target: () => tourButtonRef.current!,
        },
        {
            title: t('apiSettings'),
            description: t('tourApiDesc'),
            target: () => apiTabRef.current!,
            onNext: async () => {
                if (apiSettingsRef.current) {
                    await apiSettingsRef.current.openFirstProviderModal();
                }
                setTourCurrent(2);
            },
            onPrev: () => {
                if (apiSettingsRef.current) {
                    apiSettingsRef.current.handleCancel();
                }
                setTourCurrent(0);
            },
        },
        {
            title: t('apiKeyInput'),
            description: t('tourApiKeyDesc'),
            target: (): HTMLElement => {
                const apiKeyInput = document.getElementById('tour-api-key-input');
                return apiKeyInput || document.body;
            },
            onPrev: () => {
                // 关闭弹窗并返回到API设置步骤
                if (apiSettingsRef.current) {
                    apiSettingsRef.current.handleCancel();
                }
                setTourCurrent(1); // 返回到API设置步骤
            },
        },
        {
            title: t('modelSettings'),
            description: t('tourModelDesc'),
            target: () => modelTabRef.current!,
            onNext: () => setActiveTab('models'),
        },
        {
            title: t('interface'),
            description: t('tourInterfaceDesc'),
            target: () => interfaceTabRef.current!,
            onNext: () => setActiveTab('interface'),
        },
        {
            title: t('search'),
            description: t('tourSearchDesc'),
            target: () => searchTabRef.current!,
            onNext: () => setActiveTab('search'),
        },
        {
            title: t('tourComplete'),
            description: t('tourCompleteDesc'),
            target: () => searchTabRef.current!,
        },
    ];

    // 检查是否是首次使用
    useEffect(() => {
        const checkFirstTime = async () => {
            try {
                const hasSeenTour = await storage.get('hasSeenTour');
                if (!hasSeenTour) {
                    // 延迟显示 tour，确保页面完全加载
                    setTimeout(() => {
                        setTourOpen(true);
                    }, 1000);
                }
            } catch (error) {
                console.error('Failed to check tour status:', error);
            }
        };

        checkFirstTime();
    }, []);

    const handleTourFinish = async () => {
        setTourOpen(false);
        try {
            await storage.set('hasSeenTour', true);
            message.success(t('tourFinished') || '配置向导已完成！');
        } catch (error) {
            console.error('Failed to save tour status:', error);
        }
    };

    const startTour = () => {
        setActiveTab('api'); // 重置到第一个标签页
        setTourOpen(true);
    };

    return (
        <Layout className="app">
            <Layout className="app-layout">
                <div className="app-header">
                    <Typography.Title level={2} className="app-title">
                        <RocketOutlined /> {t('appTitle')} - {t('settings')}
                    </Typography.Title>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <Button
                            ref={tourButtonRef}
                            icon={<QuestionCircleOutlined />}
                            onClick={startTour}
                            type="text"
                            title={t('startTour') || '开始配置向导'}
                        >
                            {t('guide') || '向导'}
                        </Button>
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
                                const key =
                                    `language${value}` as keyof typeof locales[typeof locale];
                                return (
                                    <Option key={locale} value={locale}>
                                        {t(key as string)}
                                    </Option>
                                );
                            })}
                        </Select>
                    </div>
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
                                    <span ref={apiTabRef}>
                                        <ApiOutlined /> {t('apiSettings')}
                                    </span>
                                }
                                key="api"
                            >
                                <ApiSettings ref={apiSettingsRef} />
                            </TabPane>
                            <TabPane
                                tab={
                                    <span ref={modelTabRef}>
                                        <AppstoreOutlined /> {t('modelSettings')}
                                    </span>
                                }
                                key="models"
                            >
                                <ModelSettings />
                            </TabPane>
                            <TabPane
                                tab={
                                    <span ref={interfaceTabRef}>
                                        <ControlOutlined /> {t('interface')}
                                    </span>
                                }
                                key="interface"
                            >
                                <Interface form={form} />
                            </TabPane>
                            <TabPane
                                tab={
                                    <span ref={searchTabRef}>
                                        <SearchOutlined /> {t('search')}
                                    </span>
                                }
                                key="search"
                            >
                                <Search form={form} />
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

            {/* Tour 组件 */}
            <Tour
                open={tourOpen}
                onClose={() => setTourOpen(false)}
                onFinish={handleTourFinish}
                steps={tourSteps}
                current={tourCurrent}
                onChange={setTourCurrent}
                indicatorsRender={(current, total) => (
                    <span>
                        {current + 1} / {total}
                    </span>
                )}
                type="primary"
                arrow={true}
                placement="bottom"
            />
        </Layout>
    );
};

export default App;
