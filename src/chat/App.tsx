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
    Avatar,
    Spin,
    Empty,
    Tabs,
    Drawer,
    Modal,
} from 'antd';
import React, { useEffect, useState, useRef } from 'react';
import {
    GlobalOutlined,
    SettingOutlined,
    GithubOutlined,
    RocketOutlined,
    SendOutlined,
    ReloadOutlined,
    CopyOutlined,
    CloseCircleOutlined,
    RobotOutlined,
    UserOutlined,
    MenuUnfoldOutlined,
    BulbOutlined,
    QuestionCircleOutlined,
} from '@ant-design/icons';
import { md } from '@/utils/markdownRenderer';

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
import { useChatMessages } from '@/hooks/useChatMessages';
import type { ChatMessage } from '@/typings';

import './App.scss';

const { Option } = Select;
const { TextArea } = Input;

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
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [userInput, setUserInput] = useState('');
    const [activeTab, setActiveTab] = useState('chat');
    const inputRef = useRef<any>(null);
    const [suggestedPrompts, setSuggestedPrompts] = useState([
        "解释一下深度学习和机器学习的区别",
        "帮我优化一段Python代码",
        "如何提高英语口语水平",
        "推荐几本经典科幻小说"
    ]);

    // Use the useChatMessages hook
    const {
        messages,
        setMessages,
        isLoading,
        streamingMessageId,
        messagesWrapperRef,
        copyToClipboard,
        cancelStreamingResponse,
        sendChatMessage,
        regenerateResponse,
    } = useChatMessages({ t });

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

    // Add event listener for copy code buttons
    useEffect(() => {
        const handleCopyButtonClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const copyButton = target.closest('.copy-button') as HTMLButtonElement;

            if (copyButton) {
                const encodedCode = copyButton.getAttribute('data-code');
                if (encodedCode) {
                    const code = decodeURIComponent(encodedCode);
                    navigator.clipboard
                        .writeText(code)
                        .then(() => {
                            // Update button text temporarily
                            const buttonText = copyButton.querySelector('span');
                            if (buttonText) {
                                const originalText = buttonText.textContent;
                                buttonText.textContent = t('copied');
                                setTimeout(() => {
                                    buttonText.textContent = originalText;
                                }, 2000);
                            }
                            message.success(t('copied'), 2);
                        })
                        .catch(() => {
                            message.error(t('failedCopy'));
                        });
                }
            }
        };

        document.addEventListener('click', handleCopyButtonClick);

        return () => {
            document.removeEventListener('click', handleCopyButtonClick);
        };
    }, [t]);

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
            setSettingsVisible(false);
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

    const handleSendMessage = () => {
        if (userInput.trim() && !isLoading) {
            sendChatMessage(userInput.trim());
            setUserInput('');
            // Focus the input after sending
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                }
            }, 0);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const clearChat = () => {
        Modal.confirm({
            title: t('clearConfirmTitle'),
            content: t('clearConfirmContent'),
            okText: t('confirm'),
            cancelText: t('cancel'),
            onOk: () => {
                setMessages([]);
                message.success(t('chatCleared'));
            },
        });
    };

    const renderMessageContent = (msg: ChatMessage) => {
        if (msg.sender === 'system') {
            return <div className="system-message">{msg.text}</div>;
        }

        if (msg.thinking) {
            return (
                <div className="thinking-message">
                    <div className="thinking-indicator">{msg.thinking}</div>
                    <div dangerouslySetInnerHTML={{ __html: md.render(msg.text || '') }} />
                </div>
            );
        }

        return <div dangerouslySetInnerHTML={{ __html: md.render(msg.text) }} />;
    };

    const renderSettingsDrawer = () => (
        <Drawer
            title={
                <Typography.Title level={4}>
                    <SettingOutlined /> {t('settings')}
                </Typography.Title>
            }
            placement="right"
            width={480}
            onClose={() => setSettingsVisible(false)}
            open={settingsVisible}
        >
            <Form
                form={form}
                name="setting"
                className="form"
                onFinish={onFinish}
                layout="vertical"
                requiredMark={false}
                size="middle"
            >
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
                                <Input.Password placeholder={t('enterApiKey')} />
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

                <Form.Item
                    shouldUpdate={(prevValues, currentValues) =>
                        prevValues.webSearchEnabled !== currentValues.webSearchEnabled
                    }
                >
                    {({ getFieldValue }) =>
                        getFieldValue('webSearchEnabled') ? (
                            <>
                                <Form.Item
                                    label="Tavily API Key"
                                    name="tavilyApiKey"
                                    rules={[
                                        {
                                            required: false,
                                            message: 'Please enter Tavily API Key',
                                        },
                                    ]}
                                >
                                    <Input.Password
                                        value={tavilyApiKey}
                                        onChange={(e) => setTavilyApiKey(e.target.value)}
                                        placeholder="Please enter Tavily API Key"
                                    />
                                </Form.Item>

                                <Form.Item
                                    label="Search Engines"
                                    name="searchEngines"
                                    rules={[
                                        {
                                            required: true,
                                            message:
                                                'Please select at least one search engine when web search is enabled',
                                        },
                                        {
                                            validator: (_, value) => {
                                                if (!value || value.length === 0) {
                                                    return Promise.reject(
                                                        'Please select at least one search engine when web search is enabled',
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

                                <Form.Item label="Filtered Domains">
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
                                                    No filtered domains
                                                </div>
                                            )}
                                        </div>
                                        <div className="add-domain-container">
                                            <Input
                                                placeholder="Enter domain to filter"
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
                                                Add
                                            </Button>
                                        </div>
                                    </div>
                                </Form.Item>
                            </>
                        ) : null
                    }
                </Form.Item>

                <Divider />

                <Form.Item className="form-actions">
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={loadingState !== LOADING_STATE.SAVE}
                        block
                    >
                        {loadingState === LOADING_STATE.VALIDATING
                            ? t('validatingApi')
                            : loadingState === LOADING_STATE.SAVING
                            ? t('savingConfig')
                            : t('saveConfig')}
                    </Button>
                </Form.Item>
            </Form>

            <div className="drawer-footer">
                <Space split={<Divider type="vertical" />}>
                    <Typography.Link onClick={onSetShortcuts} className="footer-link">
                        <SettingOutlined /> {t('setShortcuts')}
                    </Typography.Link>
                    <Typography.Link href={GIT_URL} target="_blank" className="footer-link">
                        <GithubOutlined /> {t('starAuthor')}
                    </Typography.Link>
                </Space>
            </div>
        </Drawer>
    );

    return (
        <div className="app">
            <div className="chat-container">
                <div className="chat-header">
                    <div className="chat-title">
                        <RocketOutlined /> {t('appTitle')}
                    </div>
                    <div className="header-actions">
                        <Select
                            value={currentLocale}
                            onChange={handleLanguageChange}
                            className="language-selector"
                            dropdownMatchSelectWidth={false}
                            bordered={false}
                            suffixIcon={<GlobalOutlined />}
                            style={{ width: 'auto' }}
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
                        <Button
                            type="text"
                            icon={<SettingOutlined />}
                            onClick={() => setSettingsVisible(true)}
                            className="settings-button"
                        />
                    </div>
                </div>

                <div className="chat-body">
                    <div className="messages-container" ref={messagesWrapperRef}>
                        {messages.length === 0 ? (
                            <div className="welcome-container">
                                <Empty
                                    image={
                                        <RocketOutlined
                                            style={{ fontSize: '64px', color: '#1890ff' }}
                                        />
                                    }
                                    description={
                                        <Typography.Text strong>
                                            {t('welcomeMessage') ||
                                                '欢迎使用DeepSeek聊天！有什么可以帮助您？'}
                                        </Typography.Text>
                                    }
                                />
                                <div className="prompt-suggestions">
                                    <Typography.Title level={5}>
                                        <BulbOutlined /> {t('tryAsking') || '尝试提问：'}
                                    </Typography.Title>
                                    <div className="suggestion-items">
                                        {suggestedPrompts.map((prompt, index) => (
                                            <Button
                                                key={index}
                                                className="suggestion-item"
                                                onClick={() => {
                                                    setUserInput(prompt);
                                                    setTimeout(() => {
                                                        if (inputRef.current) {
                                                            inputRef.current.focus();
                                                        }
                                                    }, 0);
                                                }}
                                            >
                                                {prompt}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div 
                                    key={msg.id} 
                                    className={`message ${msg.sender === 'user' ? 'user-message' : 'ai-message'}`}
                                >
                                    <div className="message-avatar">
                                        {msg.sender === 'user' ? (
                                            <Avatar icon={<UserOutlined />} />
                                        ) : (
                                            <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff' }} />
                                        )}
                                    </div>
                                    <div className="message-content">
                                        <div className="message-header">
                                            <div className="message-sender">
                                                {msg.sender === 'user' ? t('you') : selectedProvider}
                                            </div>
                                        </div>
                                        <div className="message-text">
                                            {renderMessageContent(msg)}
                                        </div>
                                        {msg.sender === 'ai' && streamingMessageId !== msg.id && (
                                            <div className="message-actions">
                                                <Button 
                                                    type="text" 
                                                    icon={<CopyOutlined />} 
                                                    size="small"
                                                    onClick={() => copyToClipboard(msg.text)}
                                                    title={t('copy')}
                                                >
                                                    {t('copy') || '复制'}
                                                </Button>
                                                <Button 
                                                    type="text" 
                                                    icon={<ReloadOutlined />} 
                                                    size="small"
                                                    onClick={() => regenerateResponse()}
                                                    title={t('regenerate')}
                                                >
                                                    {t('regenerate') || '重新生成'}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        {isLoading && streamingMessageId === null && (
                            <div className="loading-indicator">
                                <Spin size="small" /> <span>{t('thinking')}</span>
                            </div>
                        )}
                    </div>

                    <div className="chat-footer">
                        <div className="input-container">
                            <TextArea
                                ref={inputRef}
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t('typeMessage') || '输入您的问题...'}
                                autoSize={{ minRows: 1, maxRows: 5 }}
                                disabled={isLoading}
                            />
                            <div className="input-actions">
                                {streamingMessageId !== null && (
                                    <Button
                                        type="text"
                                        icon={<CloseCircleOutlined />}
                                        onClick={cancelStreamingResponse}
                                        title={t('stop')}
                                    />
                                )}
                                <Tooltip
                                    title={
                                        userInput.trim()
                                            ? t('sendMessage') || '发送'
                                            : t('enterQuestion') || '请输入问题'
                                    }
                                >
                                    <Button
                                        type="primary"
                                        icon={<SendOutlined />}
                                        onClick={handleSendMessage}
                                        disabled={!userInput.trim() || isLoading}
                                    />
                                </Tooltip>
                            </div>
                        </div>
                        <div className="footer-actions">
                            {messages.length > 0 ? (
                                <>
                                    <Button 
                                        type="text" 
                                        onClick={clearChat}
                                        disabled={messages.length === 0 || isLoading}
                                        title={t('clear')}
                                    >
                                        {t('clear')}
                                    </Button>
                                </>
                            ) : (
                                <div className="footer-tips">
                                    <QuestionCircleOutlined /> {t('pressTip') || "按回车键发送，Shift+回车换行"}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {renderSettingsDrawer()}
        </div>
    );
};

export default App;
