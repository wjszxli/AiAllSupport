import {
    Button,
    Form,
    Input,
    message as messageApi,
    Switch,
    Tag,
    Tooltip,
    Typography,
    Select,
} from 'antd';
import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { t } from '@/locales/i18n';
import { SEARCH_ENGINE_NAMES, SEARCH_ENGINES } from '@/utils/constant';
import rootStore from '@/store';

interface SearchProps {
    form: any;
    onValuesChange: (changedValues: any, allValues: any) => void;
}

const Search: React.FC<SearchProps> = observer(({ form, onValuesChange }) => {
    const { settingStore } = rootStore;
    const [newFilterDomain, setNewFilterDomain] = useState<string>('');
    const [tavilyApiKey, setTavilyApiKey] = useState<string>('');
    const [exaApiKey, setExaApiKey] = useState<string>('');
    const [bochaApiKey, setBochaApiKey] = useState<string>('');
    const [selectedEngines, setSelectedEngines] = useState<string[]>(
        settingStore.enabledSearchEngines,
    );

    console.log('selectedEngines', settingStore.enabledSearchEngines);

    // Group search engines
    const freeSearchEngines = Object.entries(SEARCH_ENGINES).filter(([_, value]) =>
        SEARCH_ENGINE_NAMES[value]?.includes('免费'),
    );

    const apiKeySearchEngines = Object.entries(SEARCH_ENGINES).filter(([_, value]) =>
        SEARCH_ENGINE_NAMES[value]?.includes('需密钥'),
    );

    // Track changes in enabledSearchEngines from the store
    useEffect(() => {
        setSelectedEngines(settingStore.enabledSearchEngines);
    }, [settingStore.enabledSearchEngines]);

    useEffect(() => {
        const initData = async () => {
            const currentSearchEngines = settingStore.enabledSearchEngines || [];
            setSelectedEngines(currentSearchEngines);

            form.setFieldsValue({
                webSearchEnabled: settingStore.webSearchEnabled,
                searchEngines: currentSearchEngines,
                tavilyApiKey: settingStore.tavilyApiKey,
                exaApiKey: settingStore.exaApiKey,
                bochaApiKey: settingStore.bochaApiKey,
            });

            setTavilyApiKey(settingStore.tavilyApiKey || '');
            setExaApiKey(settingStore.exaApiKey || '');
            setBochaApiKey(settingStore.bochaApiKey || '');
        };

        initData();
    }, [form, settingStore]);

    // Update form when selected engines change
    useEffect(() => {
        form.setFieldsValue({ searchEngines: selectedEngines });
    }, [selectedEngines, form]);

    const handleAddFilterDomain = () => {
        if (newFilterDomain && !settingStore.filteredDomains.includes(newFilterDomain)) {
            settingStore.addFilteredDomain(newFilterDomain);
            setNewFilterDomain('');
        }
    };

    const handleRemoveFilterDomain = (domain: string) => {
        settingStore.removeFilteredDomain(domain);
    };

    const handleSearchEnginesChange = (value: string[]) => {
        if (value.length > 3) {
            messageApi.warning(t('selectAtMostThreeSearchEngines'));
            return;
        }

        setSelectedEngines(value);
        settingStore.setEnabledSearchEngines(value);
        form.setFieldsValue({ searchEngines: value });
    };

    const handleTavilyApiKeyChange = (value: string) => {
        setTavilyApiKey(value);
        settingStore.setTavilyApiKey(value);
    };

    const handleExaApiKeyChange = (value: string) => {
        setExaApiKey(value);
        settingStore.setExaApiKey(value);
    };

    const handleBochaApiKeyChange = (value: string) => {
        setBochaApiKey(value);
        settingStore.setBochaApiKey(value);
    };

    const handleWebSearchChange = (checked: boolean) => {
        settingStore.setWebSearchEnabled(checked);
    };

    return (
        <Form
            form={form}
            name="setting"
            className="form"
            layout="vertical"
            requiredMark={false}
            size="large"
            onValuesChange={onValuesChange}
        >
            <Form.Item
                name="webSearchEnabled"
                valuePropName="checked"
                label={t('webSearch')}
                tooltip={t('webSearchTooltip')}
            >
                <Switch
                    checked={form.getFieldValue('webSearchEnabled')}
                    onChange={handleWebSearchChange}
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
                                <Select
                                    mode="multiple"
                                    placeholder={t('selectAtLeastOneSearchEngine')}
                                    value={selectedEngines}
                                    onChange={handleSearchEnginesChange}
                                    style={{ width: '100%' }}
                                    optionLabelProp="label"
                                >
                                    <Select.OptGroup label="免费搜索引擎">
                                        {freeSearchEngines.map(([_, value]) => (
                                            <Select.Option
                                                key={value}
                                                value={value}
                                                label={SEARCH_ENGINE_NAMES[value] || value}
                                            >
                                                {SEARCH_ENGINE_NAMES[value] || value}
                                            </Select.Option>
                                        ))}
                                    </Select.OptGroup>
                                    <Select.OptGroup label="需要API密钥的搜索引擎">
                                        {apiKeySearchEngines.map(([_, value]) => (
                                            <Select.Option
                                                key={value}
                                                value={value}
                                                label={SEARCH_ENGINE_NAMES[value] || value}
                                            >
                                                {SEARCH_ENGINE_NAMES[value] || value}
                                            </Select.Option>
                                        ))}
                                    </Select.OptGroup>
                                </Select>
                            </Form.Item>

                            {/* API Key Inputs */}
                            {(() => {
                                // Use direct string values for comparison
                                const tavilyValue = 'tavily';
                                const exaValue = 'exa';
                                const bochaValue = 'bocha';

                                const showTavily = selectedEngines.includes(tavilyValue);
                                const showExa = selectedEngines.includes(exaValue);
                                const showBocha = selectedEngines.includes(bochaValue);

                                return (
                                    <>
                                        {showTavily && (
                                            <Form.Item
                                                label={t('tavilyApiKey')}
                                                name="tavilyApiKey"
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: t('enterTavilyApiKey'),
                                                    },
                                                ]}
                                            >
                                                <>
                                                    <Input.Password
                                                        value={tavilyApiKey}
                                                        onChange={(e) =>
                                                            handleTavilyApiKeyChange(e.target.value)
                                                        }
                                                        placeholder={t('enterTavilyApiKey')}
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

                                        {showExa && (
                                            <Form.Item
                                                label={t('exaApiKey')}
                                                name="exaApiKey"
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: t('enterExaApiKey'),
                                                    },
                                                ]}
                                            >
                                                <>
                                                    <Input.Password
                                                        value={exaApiKey}
                                                        onChange={(e) =>
                                                            handleExaApiKeyChange(e.target.value)
                                                        }
                                                        placeholder={t('enterExaApiKey')}
                                                    />
                                                    <div className="api-link">
                                                        <Typography.Link
                                                            href="https://exa.ai/pricing"
                                                            target="_blank"
                                                        >
                                                            {t('getExaApiKey')}
                                                        </Typography.Link>
                                                    </div>
                                                </>
                                            </Form.Item>
                                        )}

                                        {showBocha && (
                                            <Form.Item
                                                label={t('bochaApiKey')}
                                                name="bochaApiKey"
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: t('enterBochaApiKey'),
                                                    },
                                                ]}
                                            >
                                                <>
                                                    <Input.Password
                                                        value={bochaApiKey}
                                                        onChange={(e) =>
                                                            handleBochaApiKeyChange(e.target.value)
                                                        }
                                                        placeholder={t('enterBochaApiKey')}
                                                    />
                                                    <div className="api-link">
                                                        <Typography.Link
                                                            href="https://open.bochaai.com/api-keys"
                                                            target="_blank"
                                                        >
                                                            {t('getBochaApiKey')}
                                                        </Typography.Link>
                                                    </div>
                                                </>
                                            </Form.Item>
                                        )}
                                    </>
                                );
                            })()}

                            <Form.Item label={t('filteredDomains')}>
                                <div className="filtered-domains-container">
                                    <div className="filtered-domains-list">
                                        {settingStore.filteredDomains.length > 0 ? (
                                            settingStore.filteredDomains.map((domain, index) => (
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
        </Form>
    );
});

export default Search;
