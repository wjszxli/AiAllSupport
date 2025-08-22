import {
    ApiOutlined,
    ControlOutlined,
    GlobalOutlined,
    InfoCircleOutlined,
    SearchOutlined,
    AppstoreOutlined,
    QuestionCircleOutlined,
    FileTextOutlined,
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
import RocketIcon from '@/components/RocketIcon';

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
    const [modelActiveTab, setModelActiveTab] = useState('chat');

    // Tour 相关状态
    const [tourOpen, setTourOpen] = useState(false);
    const apiTabRef = useRef<HTMLDivElement>(null);
    const modelTabRef = useRef<HTMLDivElement>(null);
    const interfaceTabRef = useRef<HTMLDivElement>(null);
    const searchTabRef = useRef<HTMLDivElement>(null);
    const tourButtonRef = useRef<HTMLButtonElement>(null);

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
            title: t('tourGetApiKey'),
            description: t('tourGetApiKeyDesc'),
            target: (): HTMLElement => {
                // 查找获取 API 密钥的按钮
                const getApiKeyButtons = Array.from(
                    document.querySelectorAll('a, button'),
                ) as HTMLElement[];
                const getApiKeyButton = getApiKeyButtons.find(
                    (btn) =>
                        btn.textContent?.includes('获取 API 密钥') ||
                        (btn.textContent?.includes('获取') &&
                            btn.getAttribute('href')?.includes('api')),
                );
                return getApiKeyButton || document.body;
            },
            onPrev: () => {
                setTourCurrent(2); // 返回到 API 密钥输入步骤
            },
        },
        {
            title: t('tourSaveConfig'),
            description: t('tourSaveConfigDesc'),
            target: (): HTMLElement => {
                // 查找保存按钮
                const saveButton =
                    (document.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLElement) ||
                    (Array.from(document.querySelectorAll('.ant-modal-footer button')).find((btn) =>
                        btn.textContent?.includes('保存'),
                    ) as HTMLElement);
                return saveButton || document.body;
            },
            onNext: () => {
                // 触发保存并关闭弹窗，然后切换到模型设置页面
                if (apiSettingsRef.current) {
                    apiSettingsRef.current.handleCancel();
                }
                // 延迟切换到模型设置页面，等待弹窗关闭
                setTimeout(() => {
                    setActiveTab('models');
                    setTourCurrent(5);
                }, 0);
            },
            onPrev: () => {
                setTourCurrent(3); // 返回到获取 API 密钥步骤
            },
        },
        {
            title: t('modelSettings'),
            description: t('tourModelDesc'),
            target: () => modelTabRef.current!,
            onPrev: () => {
                setActiveTab('api');
                // Need to reopen the API modal when going back
                setTimeout(async () => {
                    if (apiSettingsRef.current) {
                        await apiSettingsRef.current.openFirstProviderModal();
                    }
                    setTourCurrent(2); // Go to API key input step
                }, 100);
            },
            onNext: () => {
                setActiveTab('models');
                setTourCurrent(6);
            },
        },
        {
            title: t('tourChatModel'),
            description: t('tourChatModelDesc'),
            target: (): HTMLElement => {
                // 确保切换到聊天模型标签页
                setModelActiveTab('chat');
                // 查找聊天界面模型选择器
                const chatModelSelect = document.getElementById(
                    'tour-chat-model-select',
                ) as HTMLElement;
                return chatModelSelect || document.body;
            },
            onNext: () => {
                // 前往弹窗模型步骤
                setTourCurrent(7);
            },
            onPrev: () => {
                // 返回到模型设置概览
                setTourCurrent(5);
            },
        },
        {
            title: t('tourPopupModel'),
            description: t('tourPopupModelDesc'),
            target: (): HTMLElement => {
                // 确保切换到弹窗模型标签页
                setModelActiveTab('popup');
                // 查找弹窗界面模型选择器
                const popupModelSelect = document.getElementById(
                    'tour-popup-model-select',
                ) as HTMLElement;
                return popupModelSelect || document.body;
            },
            onNext: () => {
                // 前往侧边栏模型步骤
                setTourCurrent(8);
            },
            onPrev: () => {
                // 返回到聊天模型标签页
                setModelActiveTab('chat');
                setTourCurrent(6);
            },
        },
        {
            title: t('tourSidebarModel'),
            description: t('tourSidebarModelDesc'),
            target: (): HTMLElement => {
                // 确保切换到侧边栏模型标签页
                setModelActiveTab('sidebar');
                // 查找侧边栏界面模型选择器
                const sidebarModelSelect = document.getElementById(
                    'tour-sidebar-model-select',
                ) as HTMLElement;
                return sidebarModelSelect || document.body;
            },
            onNext: () => {
                // 前往界面设置
                setActiveTab('interface');
                setTourCurrent(9);
            },
            onPrev: () => {
                // 返回到弹窗模型标签页
                setModelActiveTab('popup');
                setTourCurrent(7);
            },
        },
        {
            title: t('interface'),
            description: t('tourInterfaceDesc'),
            target: () => interfaceTabRef.current!,
            onNext: () => {
                setActiveTab('interface');
                setTourCurrent(10);
            },
            onPrev: () => {
                // 返回到侧边栏模型步骤
                setActiveTab('models');
                setModelActiveTab('sidebar');
                setTourCurrent(8);
            },
        },
        {
            title: t('tourSelectionToolbar'),
            description: t('tourSelectionToolbarDesc'),
            target: (): HTMLElement => {
                // 查找划词工具栏配置项
                const selectionToolbar = document.getElementById(
                    'tour-selection-toolbar',
                ) as HTMLElement;
                return selectionToolbar || document.body;
            },
            onPrev: () => {
                // 返回到界面设置步骤
                setTourCurrent(9);
            },
        },
        {
            title: t('tourWebpageContext'),
            description: t('tourWebpageContextDesc'),
            target: (): HTMLElement => {
                // 查找网页上下文配置项
                const webpageContext = document.getElementById(
                    'tour-webpage-context',
                ) as HTMLElement;
                return webpageContext || document.body;
            },
            onPrev: () => {
                setTourCurrent(10);
            },
            onNext: () => {
                setActiveTab('search');
                setTourCurrent(12);
            },
        },
        {
            title: t('search'),
            description: t('tourSearchDesc'),
            target: () => searchTabRef.current!,
            onNext: () => {
                setActiveTab('search');
                setTourCurrent(13);
            },
            onPrev: () => {
                setActiveTab('interface');
                setTourCurrent(11);
            },
        },
        {
            title: t('tourWebSearch'),
            description: t('tourWebSearchDesc'),
            target: (): HTMLElement => {
                // 查找网页搜索配置项
                const webSearch = document.getElementById('tour-web-search') as HTMLElement;
                return webSearch || document.body;
            },
            onNext: () => {
                // 启用网络搜索并跳转到搜索引擎选择
                const webSearchSwitch = document.getElementById('tour-web-search') as HTMLElement;
                if (webSearchSwitch) {
                    // 检查当前状态，如果未启用则点击启用
                    const isChecked = webSearchSwitch.getAttribute('aria-checked') === 'true';
                    if (!isChecked) {
                        webSearchSwitch.click();
                    }
                }
                // 延迟一下让DOM更新
                setTimeout(() => {
                    setTourCurrent(14);
                }, 100);
            },
            onPrev: () => {
                // 返回到搜索设置步骤
                setTourCurrent(12);
            },
        },
        {
            title: t('tourSearchEngines'),
            description: t('tourSearchEnginesDesc'),
            target: (): HTMLElement => {
                // 查找搜索引擎选择器并自动打开下拉框
                const searchEngines = document.getElementById('tour-search-engines') as HTMLElement;
                if (searchEngines) {
                    // 延迟一下确保DOM已更新
                    setTimeout(() => {
                        // 模拟点击以打开下拉框
                        searchEngines.click();
                    }, 200);
                }
                return searchEngines || document.body;
            },
            onNext: () => {
                // 跳转到关于页面的点赞步骤
                setActiveTab('about');
                setTourCurrent(15);
            },
            onPrev: () => {
                // 返回到网络搜索步骤
                setTourCurrent(13);
            },
        },
        {
            title: t('tourStarAuthor'),
            description: t('tourStarAuthorDesc'),
            target: (): HTMLElement => {
                // 切换到关于页面并查找点赞链接
                setActiveTab('about');
                const starAuthor = document.getElementById('tour-star-author') as HTMLElement;
                return starAuthor || document.body;
            },
            onPrev: () => {
                // 返回到搜索引擎步骤
                setActiveTab('search');
                setTourCurrent(14);
            },
        },
        {
            title: t('tourComplete'),
            description: t('tourCompleteDesc'),
            target: () => {
                // 保持在关于页面
                const starAuthor = document.getElementById('tour-star-author') as HTMLElement;
                return starAuthor || document.body;
            },
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
        setTourCurrent(0);
    };

    // 总结当前页面
    const handleSummarizePage = async () => {
        try {
            // 获取当前活动的标签页
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];

            if (activeTab?.id) {
                // 向内容脚本发送总结请求
                await chrome.tabs.sendMessage(activeTab.id, {
                    action: 'summarizeCurrentPage',
                });

                message.success('正在打开页面总结...');
            } else {
                message.error('无法获取当前页面信息');
            }
        } catch (error) {
            console.error('Failed to summarize page:', error);
            message.error('打开页面总结失败');
        }
    };

    return (
        <Layout className="app">
            <Layout className="app-layout">
                <div className="app-header">
                    <Typography.Title level={2} className="app-title">
                        <RocketIcon size={20} /> {t('appTitle')} - {t('settings')}
                    </Typography.Title>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <Button
                            icon={<FileTextOutlined />}
                            onClick={handleSummarizePage}
                            type="text"
                            title={t('summarizePage') || '总结当前页面'}
                        >
                            {t('summarizePage') || '总结页面'}
                        </Button>
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
                                <ModelSettings
                                    activeKey={modelActiveTab}
                                    onTabChange={setModelActiveTab}
                                />
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
            <Tour
                open={tourOpen}
                onClose={() => setTourOpen(false)}
                onFinish={handleTourFinish}
                steps={tourSteps.map((step) => ({
                    ...step,
                    nextButtonProps: {
                        children: t('tourNext'),
                    },
                    prevButtonProps: {
                        children: t('tourPrev'),
                    },
                }))}
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
