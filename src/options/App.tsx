import {
    Button,
    Form,
    Input,
    message,
    Select,
    Switch,
    Tooltip,
    Typography,
    Divider,
    Card,
    Space,
    Checkbox,
    Tag,
    Layout,
    Tabs,
} from 'antd';
import React, { useEffect, useState } from 'react';
import {
    GlobalOutlined,
    SettingOutlined,
    GithubOutlined,
    RocketOutlined,
    ApiOutlined,
    SearchOutlined,
    ControlOutlined,
    InfoCircleOutlined,
} from '@ant-design/icons';

import { modelList, validateApiKey } from '@/services';
import { t, getLocale, setLocale } from '@/services/i18n';
import type { LocaleType } from '@/locales';
import { locales } from '@/locales';
import { isLocalhost } from '@/utils';
import {
    GIT_URL,
    PROVIDERS_DATA,
    SHORTCUTS_URL,
    isFirefox,
    DEFAULT_SEARCH_ENGINES,
    FILTERED_DOMAINS,
    SEARCH_ENGINES,
    SEARCH_ENGINE_NAMES,
} from '@/utils/constant';
import storage from '@/utils/storage';
import { featureSettings } from '@/utils/featureSettings';

import './App.scss';

const { Option } = Select;
const { TabPane } = Tabs;
const { Content } = Layout;

const App: React.FC = () => {
    const [form] = Form.useForm();
    const LOADING_STATE = {
        SAVE: 'SAVE',
        SAVING: 'SAVING',
        VALIDATING: 'VALIDATING',
    };
    const [loadingState, setLoadingState] = useState<string>(LOADING_STATE.SAVE);
    const [selectedProvider, setSelectedProvider] = useState('DeepSeek');
    const [models, setModels] = useState<Array<{ label: string; value: string }>>([]);
    const [currentLocale, setCurrentLocale] = useState<LocaleType>(getLocale());
    const [enabledSearchEngines, setEnabledSearchEngines] =
        useState<string[]>(DEFAULT_SEARCH_ENGINES);
    const [tavilyApiKey, setTavilyApiKey] = useState<string>('');
    const [filteredDomains, setFilteredDomains] = useState<string[]>(FILTERED_DOMAINS);
    const [newFilterDomain, setNewFilterDomain] = useState<string>('');
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

            await initData();
        };

        init();
    }, []);

    const initData = async () => {
        const { selectedProvider, selectedModel } = await storage.getConfig();

        if (!selectedProvider) {
            console.log('No provider selected, setting default provider');
            const defaultProvider = 'DeepSeek';
            const defaultModel = PROVIDERS_DATA[defaultProvider].models[0].value;

            form.setFieldsValue({
                provider: defaultProvider,
                model: defaultModel,
                isIcon: true,
                webSearchEnabled: false,
                useWebpageContext: false,
            });

            await storage.setProviders(PROVIDERS_DATA);
            await storage.setSelectedProvider(defaultProvider);
            await storage.setSelectedModel(defaultModel);
            await storage.setIsChatBoxIcon(true);
            await storage.setWebSearchEnabled(false);
            await storage.setUseWebpageContext(true);

            setSelectedProvider(defaultProvider);
            await getModels(defaultProvider);
            return;
        }

        const isChatBoxIcon = await storage.getIsChatBoxIcon();
        const isWebSearchEnabled = await storage.getWebSearchEnabled();
        const isUseWebpageContext = await storage.getUseWebpageContext();
        const userEnabledSearchEngines = await storage.getEnabledSearchEngines();
        const userTavilyApiKey = (await storage.getTavilyApiKey()) || '';
        const userFilteredDomains = await storage.getFilteredDomains();

        setSelectedProvider(selectedProvider);
        await getModels(selectedProvider);

        const providers = await storage.getProviders();

        setEnabledSearchEngines(userEnabledSearchEngines);
        setTavilyApiKey(userTavilyApiKey);
        setFilteredDomains(userFilteredDomains);

        form.setFieldsValue({
            provider: selectedProvider,
            apiKey: providers[selectedProvider]?.apiKey || '',
            model: selectedModel,
            isIcon: isChatBoxIcon !== undefined ? isChatBoxIcon : true,
            webSearchEnabled: isWebSearchEnabled,
            useWebpageContext: isUseWebpageContext,
            tavilyApiKey: userTavilyApiKey,
            searchEngines: userEnabledSearchEngines,
        });
    };

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

    const getModels = async (selectedProvider: string | null) => {
        if (!selectedProvider) {
            setModels([]);
            return;
        }

        if (isLocalhost(selectedProvider)) {
            const res = (await modelList(selectedProvider)) as {
                models?: Array<{ name: string; model: string }>;
            };

            if (res?.models) {
                const models = res.models.map((value) => ({
                    label: value.name,
                    value: value.model,
                }));
                setModels(models);
            }
        } else {
            const models = PROVIDERS_DATA[selectedProvider].models;
            setModels(models);
        }
    };

    const onFinish = async (values: any) => {
        try {
            // If web search is enabled but no search engines are selected, prevent submission
            if (
                values.webSearchEnabled &&
                (!enabledSearchEngines || enabledSearchEngines.length === 0)
            ) {
                message.error(
                    'Please select at least one search engine when web search is enabled',
                );
                return;
            }

            setLoadingState(LOADING_STATE.SAVING);

            const isValid = await featureSettings.validateAndSubmitSettings(values, t);
            if (!isValid) {
                setLoadingState(LOADING_STATE.SAVE);
                return;
            }

            const { provider, apiKey, model, isIcon, webSearchEnabled, useWebpageContext } = values;

            let providersData = await storage.getProviders();
            if (!providersData) {
                providersData = PROVIDERS_DATA;
            }

            providersData[provider] = {
                ...PROVIDERS_DATA[provider],
                apiKey,
                selected: true,
                selectedModel: model,
            };
            console.log('values', values);

            await Promise.all([
                storage.setProviders(providersData),
                storage.setSelectedProvider(provider),
                storage.setSelectedModel(model),
                storage.updateApiKey(provider, apiKey),
                storage.setIsChatBoxIcon(isIcon),
                storage.setWebSearchEnabled(webSearchEnabled),
                storage.setUseWebpageContext(useWebpageContext),
                storage.setEnabledSearchEngines(enabledSearchEngines || []),
                storage.setTavilyApiKey(values.tavilyApiKey || ''),
                storage.setFilteredDomains(filteredDomains),
            ]);

            message.success(t('configSaved'));
            setLoadingState(LOADING_STATE.VALIDATING);
            onValidateApiKey();
        } catch (error) {
            console.error('Failed to save configuration:', error);
            message.error(t('savingConfigError'));
            setLoadingState(LOADING_STATE.SAVE);
        }
    };

    const onProviderChange = async (value: string) => {
        setSelectedProvider(value);

        // Clear model selection first
        form.setFieldsValue({ model: undefined });

        const providers = await storage.getProviders();
        await storage.setSelectedProvider(value);
        await getModels(value);
        if (!isLocalhost(value)) {
            const apiKey = providers[value]?.apiKey;
            const model = providers[value]?.models[0].value;
            const fieldsValue = { apiKey, model };
            form.setFieldsValue(fieldsValue);
        }
    };

    const onModelChange = (value: string) => {
        form.setFieldsValue({ model: value });
    };

    const onValidateApiKey = async () => {
        try {
            await validateApiKey();
            message.success(t('apiValidSuccess'));
            setLoadingState(LOADING_STATE.SAVE);
        } catch (error) {
            setLoadingState(LOADING_STATE.SAVE);
            if (error instanceof Error) {
                message.error(error.message);
            } else {
                message.error(error as string);
            }
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

    // Handle adding a new filtered domain
    const handleAddFilterDomain = () => {
        if (newFilterDomain && !filteredDomains.includes(newFilterDomain)) {
            setFilteredDomains([...filteredDomains, newFilterDomain]);
            setNewFilterDomain('');
        }
    };

    // Handle removing a filtered domain
    const handleRemoveFilterDomain = (domain: string) => {
        setFilteredDomains(filteredDomains.filter((d) => d !== domain));
    };

    // Render API Settings Tab
    const renderApiSettings = () => (
        <>
            <Form.Item
                className="form-item"
                label={t('serviceProvider')}
                name="provider"
                rules={[{ required: true, message: t('selectProvider') }]}
            >
                <Select
                    placeholder={t('selectProvider')}
                    onChange={(value) => onProviderChange(value)}
                    allowClear
                    style={{ fontSize: '16px' }}
                >
                    {(Object.keys(PROVIDERS_DATA) as Array<keyof typeof PROVIDERS_DATA>).map(
                        (key) => (
                            <Option key={key} value={key}>
                                {PROVIDERS_DATA[key].name}
                            </Option>
                        ),
                    )}
                </Select>
            </Form.Item>

            {!isLocalhost(selectedProvider) && (
                <Form.Item className="form-item" label={t('apiKey')} name="ApiKey">
                    <>
                        <Form.Item
                            name="apiKey"
                            noStyle
                            rules={[{ required: true, message: t('enterApiKey') }]}
                        >
                            <Input placeholder={t('enterApiKey')} />
                        </Form.Item>
                        <div className="api-link">
                            <Tooltip title={t('getApiKey')}>
                                <Typography.Link
                                    href={PROVIDERS_DATA[selectedProvider].apiKeyUrl || ''}
                                    target="_blank"
                                >
                                    {t('getApiKey')}
                                </Typography.Link>
                            </Tooltip>
                        </div>
                    </>
                </Form.Item>
            )}

            <Form.Item
                className="form-item"
                label={t('modelSelection')}
                name="model"
                rules={[{ required: true, message: t('selectModel') }]}
            >
                <Select
                    placeholder={t('selectModel')}
                    onChange={(value) => onModelChange(value)}
                    options={models}
                    allowClear
                />
            </Form.Item>
        </>
    );

    // Render Interface Settings Tab
    const renderInterfaceSettings = () => (
        <>
            <Form.Item
                className="form-item"
                label={t('showIcon')}
                name="isIcon"
                valuePropName="checked"
                initialValue={true}
            >
                <Switch />
            </Form.Item>

            <Form.Item
                className="form-item"
                label={t('includeWebpage')}
                name="useWebpageContext"
                valuePropName="checked"
                initialValue={true}
                tooltip={t('includeWebpageTooltip')}
            >
                <Switch
                    onChange={(checked) => {
                        if (checked && form.getFieldValue('webSearchEnabled')) {
                            message.warning(t('exclusiveFeatureWarning'));
                            form.setFieldsValue({ useWebpageContext: false });
                        }
                    }}
                />
            </Form.Item>
        </>
    );

    // Render Search Settings Tab
    const renderSearchSettings = () => (
        <>
            <Form.Item
                name="webSearchEnabled"
                valuePropName="checked"
                label={t('webSearch')}
                tooltip={t('webSearchTooltip')}
            >
                <Switch
                    checked={form.getFieldValue('webSearchEnabled')}
                    onChange={(checked) => {
                        if (checked && form.getFieldValue('useWebpageContext')) {
                            message.warning(t('exclusiveFeatureWarning'));
                            form.setFieldsValue({ webSearchEnabled: false });
                        }
                    }}
                />
            </Form.Item>
            
            <Form.Item
                shouldUpdate={(prevValues, currentValues) =>
                    prevValues.webSearchEnabled !== currentValues.webSearchEnabled
                }
            >
                {({ getFieldValue }) =>
                    getFieldValue('webSearchEnabled') ? (
                        <>
                            <Form.Item
                                label={t('tavilyApiKey')}
                                name="tavilyApiKey"
                                rules={[
                                    { required: false, message: t('enterTavilyApiKey') },
                                ]}
                            >
                                <Input.Password
                                    value={tavilyApiKey}
                                    onChange={(e) => setTavilyApiKey(e.target.value)}
                                    placeholder={t('enterTavilyApiKey')}
                                />
                            </Form.Item>

                            <Form.Item
                                label={t('searchEngines')}
                                name="searchEngines"
                                rules={[
                                    {
                                        required: true,
                                        message: t('selectAtLeastOneSearchEngine'),
                                    },
                                    {
                                        validator: (_, value) => {
                                            if (!value || value.length === 0) {
                                                return Promise.reject(
                                                    t('selectAtLeastOneSearchEngine'),
                                                );
                                            }
                                            return Promise.resolve();
                                        },
                                    },
                                ]}
                            >
                                <div className="search-engines-container">
                                    <Checkbox.Group
                                        value={enabledSearchEngines}
                                        onChange={(value) => {
                                            setEnabledSearchEngines(value as string[]);
                                            form.setFieldsValue({ searchEngines: value });
                                        }}
                                    >
                                        {Object.entries(SEARCH_ENGINES).map(([_, value]) => (
                                            <Checkbox value={value} key={value}>
                                                {SEARCH_ENGINE_NAMES[value] || value}
                                            </Checkbox>
                                        ))}
                                    </Checkbox.Group>
                                </div>
                            </Form.Item>

                            <Form.Item label={t('filteredDomains')}>
                                <div className="filtered-domains-container">
                                    <div className="filtered-domains-list">
                                        {filteredDomains.length > 0 ? (
                                            filteredDomains.map((domain, index) => (
                                                <Tag
                                                    closable
                                                    key={index}
                                                    onClose={() =>
                                                        handleRemoveFilterDomain(domain)
                                                    }
                                                >
                                                    {domain}
                                                </Tag>
                                            ))
                                        ) : (
                                            <div className="no-domains-message">
                                                {t('noFilteredDomains')}
                                            </div>
                                        )}
                                    </div>
                                    <div className="add-domain-container">
                                        <Input
                                            placeholder={t('enterDomainToFilter')}
                                            value={newFilterDomain}
                                            onChange={(e) =>
                                                setNewFilterDomain(e.target.value)
                                            }
                                            onPressEnter={handleAddFilterDomain}
                                            style={{ width: '70%' }}
                                        />
                                        <Button
                                            type="primary"
                                            onClick={handleAddFilterDomain}
                                            style={{ marginLeft: '8px' }}
                                        >
                                            {t('add')}
                                        </Button>
                                    </div>
                                </div>
                            </Form.Item>
                        </>
                    ) : (
                        <div className="search-disabled-message">
                            <Typography.Text type="secondary">
                                {t('enableWebSearchMessage')}
                            </Typography.Text>
                        </div>
                    )
                }
            </Form.Item>
        </>
    );

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

                <Content className="app-content">
                    <Card className="settings-card">
                        <Tabs
                            activeKey={activeTab}
                            onChange={setActiveTab}
                            tabPosition="left"
                            className="settings-tabs"
                        >
                            <TabPane 
                                tab={<span><ApiOutlined /> {t('apiSettings')}</span>} 
                                key="api"
                            >
                                <Form
                                    form={form}
                                    name="setting"
                                    className="form"
                                    onFinish={onFinish}
                                    layout="vertical"
                                    requiredMark={false}
                                    size="large"
                                >
                                    {renderApiSettings()}
                                    <Form.Item className="form-actions">
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            loading={loadingState !== LOADING_STATE.SAVE}
                                            block
                                            size="large"
                                        >
                                            {loadingState === LOADING_STATE.VALIDATING
                                                ? t('validatingApi')
                                                : loadingState === LOADING_STATE.SAVING
                                                ? t('savingConfig')
                                                : t('saveConfig')}
                                        </Button>
                                    </Form.Item>
                                </Form>
                            </TabPane>
                            
                            <TabPane 
                                tab={<span><ControlOutlined /> {t('interface')}</span>} 
                                key="interface"
                            >
                                <Form
                                    form={form}
                                    name="setting"
                                    className="form"
                                    onFinish={onFinish}
                                    layout="vertical"
                                    requiredMark={false}
                                    size="large"
                                >
                                    {renderInterfaceSettings()}
                                    <Form.Item className="form-actions">
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            loading={loadingState !== LOADING_STATE.SAVE}
                                            block
                                            size="large"
                                        >
                                            {loadingState === LOADING_STATE.VALIDATING
                                                ? t('validatingApi')
                                                : loadingState === LOADING_STATE.SAVING
                                                ? t('savingConfig')
                                                : t('saveConfig')}
                                        </Button>
                                    </Form.Item>
                                </Form>
                            </TabPane>
                            
                            <TabPane 
                                tab={<span><SearchOutlined /> {t('search')}</span>} 
                                key="search"
                            >
                                <Form
                                    form={form}
                                    name="setting"
                                    className="form"
                                    onFinish={onFinish}
                                    layout="vertical"
                                    requiredMark={false}
                                    size="large"
                                >
                                    {renderSearchSettings()}
                                    <Form.Item className="form-actions">
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            loading={loadingState !== LOADING_STATE.SAVE}
                                            block
                                            size="large"
                                        >
                                            {loadingState === LOADING_STATE.VALIDATING
                                                ? t('validatingApi')
                                                : loadingState === LOADING_STATE.SAVING
                                                ? t('savingConfig')
                                                : t('saveConfig')}
                                        </Button>
                                    </Form.Item>
                                </Form>
                            </TabPane>
                            
                            <TabPane 
                                tab={<span><InfoCircleOutlined /> {t('about')}</span>} 
                                key="about"
                            >
                                <div className="about-section">
                                    <Typography.Title level={4}>
                                        {t('appTitle')}
                                    </Typography.Title>
                                    <Typography.Paragraph>
                                        {t('aboutDescription')}
                                    </Typography.Paragraph>
                                    <div className="app-links">
                                        <Typography.Link onClick={onSetShortcuts} className="link-item">
                                            <SettingOutlined /> {t('setShortcuts')}
                                        </Typography.Link>
                                        <Typography.Link href={GIT_URL} target="_blank" className="link-item">
                                            <GithubOutlined /> {t('starAuthor')}
                                        </Typography.Link>
                                    </div>
                                </div>
                            </TabPane>
                        </Tabs>
                    </Card>
                </Content>

                <div className="app-footer">
                    <Space split={<Divider type="vertical" />}>
                        <Typography.Link onClick={onSetShortcuts} className="footer-link">
                            <SettingOutlined /> {t('setShortcuts')}
                        </Typography.Link>
                        <Typography.Link href={GIT_URL} target="_blank" className="footer-link">
                            <GithubOutlined /> {t('starAuthor')}
                        </Typography.Link>
                    </Space>
                </div>
            </Layout>
        </Layout>
    );
};

export default App;
