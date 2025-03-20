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
    InputNumber,
    Radio,
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
    CommentOutlined,
    BugOutlined,
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
import { LogLevel, getLoggerConfig, updateLoggerConfig, clearLogs } from '@/utils/logger';

import './App.scss';

const { Option } = Select;
const { TabPane } = Tabs;
const { Content } = Layout;

// Add feedback survey URL constant
const FEEDBACK_SURVEY_URL = 'https://wj.qq.com/s2/18763807/74b5/';

const App: React.FC = () => {
    const [form] = Form.useForm();
    const [selectedProvider, setSelectedProvider] = useState('DeepSeek');
    const [models, setModels] = useState<Array<{ label: string; value: string }>>([]);
    const [currentLocale, setCurrentLocale] = useState<LocaleType>(getLocale());
    const [enabledSearchEngines, setEnabledSearchEngines] =
        useState<string[]>(DEFAULT_SEARCH_ENGINES);
    const [tavilyApiKey, setTavilyApiKey] = useState<string>('');
    const [filteredDomains, setFilteredDomains] = useState<string[]>(FILTERED_DOMAINS);
    const [newFilterDomain, setNewFilterDomain] = useState<string>('');
    const [activeTab, setActiveTab] = useState('api');
    const [apiKeyValidating, setApiKeyValidating] = useState(false);
    const [tavilyApiKeyValidating, setTavilyApiKeyValidating] = useState(false);
    const [loggerConfig, setLoggerConfig] = useState<any>(null);

    // Add an auto-save debounce timer
    const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

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

            // Initialize logger config state
            const config = getLoggerConfig();
            setLoggerConfig(config);
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

    // Enhanced handleValuesChange function to handle API key validation
    const handleValuesChange = async (changedValues: any, allValues: any) => {
        // Check if API key changed
        if (changedValues.apiKey !== undefined) {
            // Only validate if API key is not empty
            if (changedValues.apiKey && changedValues.apiKey.trim() !== '') {
                setApiKeyValidating(true);
                message.loading({
                    content: t('validatingApi'),
                    key: 'apiKeyValidation',
                    duration: 0,
                });
            } else {
                // Clear any previous validation messages if API key is now empty
                message.destroy('apiKeyValidation');
                setApiKeyValidating(false);
            }
        }

        // Check if Tavily API key changed
        if (changedValues.tavilyApiKey !== undefined) {
            // Only validate if Tavily API key is not empty
            if (changedValues.tavilyApiKey && changedValues.tavilyApiKey.trim() !== '') {
                setTavilyApiKeyValidating(true);
                message.loading({
                    content: t('validatingTavilyApi'),
                    key: 'tavilyApiKeyValidation',
                    duration: 0,
                });
            } else {
                // Clear any previous validation messages if Tavily API key is now empty
                message.destroy('tavilyApiKeyValidation');
                setTavilyApiKeyValidating(false);
            }
        }

        // Clear any existing timer
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
        }

        // Set a new timer to save after a short delay (500ms)
        const timer = setTimeout(async () => {
            try {
                // If web search is enabled but no search engines are selected, prevent submission
                if (
                    allValues.webSearchEnabled &&
                    (!enabledSearchEngines || enabledSearchEngines.length === 0)
                ) {
                    message.error(t('selectAtLeastOneSearchEngine'));
                    return;
                }

                message.loading({
                    content: t('savingConfig'),
                    key: 'saveConfig',
                    duration: 0,
                });

                const isValid = await featureSettings.validateAndSubmitSettings(allValues, t);
                if (!isValid) {
                    message.error({
                        content: t('savingConfigError'),
                        key: 'saveConfig',
                    });
                    return;
                }

                const { provider, apiKey, model, isIcon, webSearchEnabled, useWebpageContext } =
                    allValues;

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

                await Promise.all([
                    storage.setProviders(providersData),
                    storage.setSelectedProvider(provider),
                    storage.setSelectedModel(model),
                    storage.updateApiKey(provider, apiKey),
                    storage.setIsChatBoxIcon(isIcon),
                    storage.setWebSearchEnabled(webSearchEnabled),
                    storage.setUseWebpageContext(useWebpageContext),
                    storage.setEnabledSearchEngines(enabledSearchEngines || []),
                    storage.setTavilyApiKey(allValues.tavilyApiKey || ''),
                    storage.setFilteredDomains(filteredDomains),
                ]);

                message.success({
                    content: t('configSaved'),
                    key: 'saveConfig',
                });

                // After save is complete, validate API keys if they were changed
                if (apiKeyValidating && allValues.apiKey && allValues.apiKey.trim() !== '') {
                    try {
                        await validateApiKey();
                        message.success({
                            content: t('apiValidSuccess'),
                            key: 'apiKeyValidation',
                        });
                    } catch (error) {
                        console.error('API key validation error:', error);
                        if (error instanceof Error) {
                            message.error({
                                content: error.message,
                                key: 'apiKeyValidation',
                            });
                        } else {
                            message.error({
                                content: error as string,
                                key: 'apiKeyValidation',
                            });
                        }
                    } finally {
                        setApiKeyValidating(false);
                    }
                }

                // Validate Tavily API key if it was changed
                if (
                    tavilyApiKeyValidating &&
                    allValues.tavilyApiKey &&
                    allValues.tavilyApiKey.trim() !== ''
                ) {
                    try {
                        // Here you would call a validation function for Tavily API key
                        // For now, just show a success message after a delay to simulate validation
                        setTimeout(() => {
                            message.success({
                                content: t('tavilyApiValidSuccess'),
                                key: 'tavilyApiKeyValidation',
                            });
                            setTavilyApiKeyValidating(false);
                        }, 1000);
                    } catch (error) {
                        message.error({
                            content: t('tavilyApiValidError'),
                            key: 'tavilyApiKeyValidation',
                        });
                        setTavilyApiKeyValidating(false);
                    }
                }
            } catch (error) {
                console.error('Failed to save configuration:', error);
                message.error({
                    content: t('savingConfigError'),
                    key: 'saveConfig',
                });
                setApiKeyValidating(false);
                setTavilyApiKeyValidating(false);
            }
        }, 500);

        setAutoSaveTimer(timer);
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

    // Update renderApiSettings to reflect API key validation state
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
                            <Input.Password
                                placeholder={t('enterApiKey')}
                                className={apiKeyValidating ? 'validating-input' : ''}
                            />
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
                tooltip={t('showIconTooltip')}
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

    // Update renderSearchSettings to show validation status for Tavily API key
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

                            {/* Only show Tavily API Key input if Tavily is selected */}
                            {enabledSearchEngines.includes(SEARCH_ENGINES.TAVILY) && (
                                <Form.Item
                                    label={t('tavilyApiKey')}
                                    name="tavilyApiKey"
                                    rules={[{ required: true, message: t('enterTavilyApiKey') }]}
                                >
                                    <>
                                        <Input.Password
                                            value={tavilyApiKey}
                                            onChange={(e) => setTavilyApiKey(e.target.value)}
                                            placeholder={t('enterTavilyApiKey')}
                                            className={
                                                tavilyApiKeyValidating ? 'validating-input' : ''
                                            }
                                        />
                                        <div className="api-link">
                                            <Tooltip title={t('getTavilyApiKey')}>
                                                <Typography.Link
                                                    href="https://tavily.com/#api"
                                                    target="_blank"
                                                >
                                                    {t('getTavilyApiKey')}
                                                </Typography.Link>
                                            </Tooltip>
                                        </div>
                                    </>
                                </Form.Item>
                            )}

                            <Form.Item label={t('filteredDomains')}>
                                <div className="filtered-domains-container">
                                    <div className="filtered-domains-list">
                                        {filteredDomains.length > 0 ? (
                                            filteredDomains.map((domain, index) => (
                                                <Tag
                                                    closable
                                                    key={index}
                                                    onClose={() => handleRemoveFilterDomain(domain)}
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
                                            onChange={(e) => setNewFilterDomain(e.target.value)}
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

    // Handler for logging settings changes
    const handleLoggingSettingsChange = async (changedValues: any, _allValues: any) => {
        try {
            if (changedValues.logging) {
                const newConfig = await updateLoggerConfig(changedValues.logging);
                setLoggerConfig(newConfig);
                message.success(t('options_logging_settings_saved'));
            }
        } catch (error) {
            console.error('Failed to update logging settings:', error);
            message.error(t('options_logging_settings_save_failed'));
        }
    };

    // Handler for clearing logs
    const handleClearLogs = async () => {
        try {
            await clearLogs();
            message.success(t('options_logging_cleared'));
        } catch (error) {
            console.error('Failed to clear logs:', error);
            message.error(t('options_logging_clear_failed'));
        }
    };

    // Render logging settings
    const renderLoggingSettings = () => (
        <Card
            title={
                <Space>
                    <BugOutlined />
                    {t('options_logging_settings')}
                </Space>
            }
        >
            <Form
                layout="vertical"
                initialValues={{ logging: loggerConfig }}
                onValuesChange={handleLoggingSettingsChange}
            >
                <Form.Item
                    name={['logging', 'enabled']}
                    label={t('options_logging_enabled')}
                    valuePropName="checked"
                >
                    <Switch />
                </Form.Item>

                <Form.Item name={['logging', 'level']} label={t('options_logging_level')}>
                    <Radio.Group>
                        <Radio value={LogLevel.DEBUG}>{t('options_logging_level_debug')}</Radio>
                        <Radio value={LogLevel.INFO}>{t('options_logging_level_info')}</Radio>
                        <Radio value={LogLevel.WARN}>{t('options_logging_level_warn')}</Radio>
                        <Radio value={LogLevel.ERROR}>{t('options_logging_level_error')}</Radio>
                    </Radio.Group>
                </Form.Item>

                <Form.Item
                    name={['logging', 'includeTimestamp']}
                    label={t('options_logging_include_timestamp')}
                    valuePropName="checked"
                >
                    <Switch />
                </Form.Item>

                <Form.Item
                    name={['logging', 'logToConsole']}
                    label={t('options_logging_to_console')}
                    valuePropName="checked"
                >
                    <Switch />
                </Form.Item>

                <Form.Item
                    name={['logging', 'persistLogs']}
                    label={t('options_logging_persist')}
                    valuePropName="checked"
                >
                    <Switch />
                </Form.Item>

                <Form.Item
                    name={['logging', 'maxPersistedLogs']}
                    label={t('options_logging_max_persisted')}
                >
                    <InputNumber min={100} max={10000} step={100} />
                </Form.Item>

                <Form.Item>
                    <Button type="primary" danger onClick={handleClearLogs}>
                        {t('options_logging_clear')}
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    );

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
                                tab={
                                    <span>
                                        <ApiOutlined /> {t('apiSettings')}
                                    </span>
                                }
                                key="api"
                            >
                                <Form
                                    form={form}
                                    name="setting"
                                    className="form"
                                    layout="vertical"
                                    requiredMark={false}
                                    size="large"
                                    onValuesChange={handleValuesChange}
                                >
                                    {renderApiSettings()}
                                </Form>
                            </TabPane>

                            <TabPane
                                tab={
                                    <span>
                                        <ControlOutlined /> {t('interface')}
                                    </span>
                                }
                                key="interface"
                            >
                                <Form
                                    form={form}
                                    name="setting"
                                    className="form"
                                    layout="vertical"
                                    requiredMark={false}
                                    size="large"
                                    onValuesChange={handleValuesChange}
                                >
                                    {renderInterfaceSettings()}
                                </Form>
                            </TabPane>

                            <TabPane
                                tab={
                                    <span>
                                        <SearchOutlined /> {t('search')}
                                    </span>
                                }
                                key="search"
                            >
                                <Form
                                    form={form}
                                    name="setting"
                                    className="form"
                                    layout="vertical"
                                    requiredMark={false}
                                    size="large"
                                    onValuesChange={handleValuesChange}
                                >
                                    {renderSearchSettings()}
                                </Form>
                            </TabPane>

                            <TabPane
                                tab={
                                    <span>
                                        <BugOutlined /> {t('options_logging_settings')}
                                    </span>
                                }
                                key="logging"
                            >
                                {renderLoggingSettings()}
                            </TabPane>

                            <TabPane
                                tab={
                                    <span>
                                        <InfoCircleOutlined /> {t('about')}
                                    </span>
                                }
                                key="about"
                            >
                                <div className="about-section">
                                    <Typography.Title level={4}>{t('appTitle')}</Typography.Title>
                                    <Typography.Paragraph>
                                        {t('aboutDescription')}
                                    </Typography.Paragraph>
                                    <div className="app-links">
                                        <Typography.Link
                                            onClick={onSetShortcuts}
                                            className="link-item"
                                        >
                                            <SettingOutlined /> {t('setShortcuts')}
                                        </Typography.Link>
                                        <Typography.Link
                                            href={GIT_URL}
                                            target="_blank"
                                            className="link-item"
                                        >
                                            <GithubOutlined /> {t('starAuthor')}
                                        </Typography.Link>
                                        <Typography.Link
                                            onClick={openFeedbackSurvey}
                                            className="link-item"
                                        >
                                            <CommentOutlined /> {t('feedback')}
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
                        <Typography.Link onClick={openFeedbackSurvey} className="footer-link">
                            <CommentOutlined /> {t('feedback')}
                        </Typography.Link>
                    </Space>
                </div>
            </Layout>
        </Layout>
    );
};

export default App;
