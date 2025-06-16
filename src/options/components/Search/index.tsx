import {
    Button,
    Checkbox,
    Form,
    Input,
    message as messageApi,
    Switch,
    Tag,
    Tooltip,
    Typography,
} from 'antd';
import React, { useEffect, useState } from 'react';

import { t } from '@/locales/i18n';
import { FILTERED_DOMAINS, SEARCH_ENGINE_NAMES, SEARCH_ENGINES } from '@/utils/constant';
import storage from '@/utils/storage';

interface SearchProps {
    form: any;
    onValuesChange: (changedValues: any, allValues: any) => void;
}

const Search: React.FC<SearchProps> = ({ form, onValuesChange }) => {
    const [enabledSearchEngines, setEnabledSearchEngines] = useState<string[]>([]);
    const [tavilyApiKey, setTavilyApiKey] = useState<string>('');
    const [filteredDomains, setFilteredDomains] = useState<string[]>(FILTERED_DOMAINS);
    const [newFilterDomain, setNewFilterDomain] = useState<string>('');

    useEffect(() => {
        const initData = async () => {
            const userEnabledSearchEngines = await storage.getEnabledSearchEngines();
            const userTavilyApiKey = (await storage.getTavilyApiKey()) || '';
            const userFilteredDomains = await storage.getFilteredDomains();

            setEnabledSearchEngines(userEnabledSearchEngines);
            setTavilyApiKey(userTavilyApiKey);
            setFilteredDomains(userFilteredDomains);

            form.setFieldsValue({
                webSearchEnabled: await storage.getWebSearchEnabled(),
                searchEngines: userEnabledSearchEngines,
                tavilyApiKey: userTavilyApiKey,
            });
        };

        initData();
    }, [form]);

    const handleAddFilterDomain = () => {
        if (newFilterDomain && !filteredDomains.includes(newFilterDomain)) {
            const newDomains = [...filteredDomains, newFilterDomain];
            setFilteredDomains(newDomains);
            setNewFilterDomain('');
            storage.setFilteredDomains(newDomains);
        }
    };

    const handleRemoveFilterDomain = (domain: string) => {
        const newDomains = filteredDomains.filter((d) => d !== domain);
        setFilteredDomains(newDomains);
        storage.setFilteredDomains(newDomains);
    };

    const handleSearchEnginesChange = (value: string[]) => {
        setEnabledSearchEngines(value);
        form.setFieldsValue({ searchEngines: value });
        storage.setEnabledSearchEngines(value);
    };

    const handleTavilyApiKeyChange = (value: string) => {
        setTavilyApiKey(value);
        storage.setTavilyApiKey(value);
    };

    const handleWebSearchChange = (checked: boolean) => {
        if (checked && form.getFieldValue('useWebpageContext')) {
            messageApi.warning(t('exclusiveFeatureWarning'));
            form.setFieldsValue({ webSearchEnabled: false });
            return;
        }
        storage.setWebSearchEnabled(checked);
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
                                <div className="search-engines-container">
                                    <Checkbox.Group
                                        value={enabledSearchEngines}
                                        onChange={handleSearchEnginesChange}
                                    >
                                        {Object.entries(SEARCH_ENGINES).map(([_, value]) => (
                                            <Checkbox value={value} key={value}>
                                                {SEARCH_ENGINE_NAMES[value] || value}
                                            </Checkbox>
                                        ))}
                                    </Checkbox.Group>
                                </div>
                            </Form.Item>

                            {enabledSearchEngines.includes(SEARCH_ENGINES.TAVILY) && (
                                <Form.Item
                                    label={t('tavilyApiKey')}
                                    name="tavilyApiKey"
                                    rules={[{ required: true, message: t('enterTavilyApiKey') }]}
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
        </Form>
    );
};

export default Search;
