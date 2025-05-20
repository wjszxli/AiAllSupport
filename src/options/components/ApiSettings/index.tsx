import { Button, Form, Input, message, Select, Tooltip, Typography } from 'antd';
import React, { useEffect, useState } from 'react';

import { modelList, validateApiKey } from '@/services';
import { t } from '@/services/i18n';
import { isLocalhost } from '@/utils';
import { PROVIDERS_DATA } from '@/utils/constant';
import storage from '@/utils/storage';

const { Option } = Select;

const ApiSettings: React.FC = () => {
    const [form] = Form.useForm();
    const [apiKeyValidated, setApiKeyValidated] = useState<boolean>(false);
    const [models, setModels] = useState<Array<{ label: string; value: string }>>([]);
    const [selectedProvider, setSelectedProvider] = useState<string>('DeepSeek');

    const initData = async () => {
        const selectedProvider = await storage.getSelectedProvider();
        setSelectedProvider(selectedProvider);
        const providers = (await storage.getProviders()) || PROVIDERS_DATA;
        const models = await getModels(selectedProvider);
        setModels(models);

        let selectedModel = providers[selectedProvider].selectedModel;
        if (!selectedModel && models.length > 0) {
            selectedModel = models[0].value;
        }

        form.setFieldsValue({
            provider: selectedProvider,
            apiKey: providers[selectedProvider]?.apiKey || '',
            apiHost:
                providers[selectedProvider]?.apiHost || PROVIDERS_DATA[selectedProvider].apiHost,
            model: selectedModel,
        });
    };

    useEffect(() => {
        initData();
    }, []);

    const getModels = async (selectedProvider: string | null) => {
        if (!selectedProvider) {
            return [];
        }

        if (isLocalhost(selectedProvider)) {
            const res = (await modelList(selectedProvider)) as {
                models?: Array<{ name: string; model: string }>;
            };

            if (res?.models) {
                return res.models.map((value) => ({
                    label: value.name,
                    value: value.model,
                }));
            }
            return [];
        }

        const models = PROVIDERS_DATA[selectedProvider].models;
        return models;
    };

    const onApiKeyChange = async (value: string) => {
        const { provider } = form.getFieldsValue();
        await storage.updateApiKey(provider, value);
    };

    const onApiHostChange = async (value: string) => {
        const { provider } = form.getFieldsValue();
        let providersData = await storage.getProviders();
        if (!providersData) {
            providersData = PROVIDERS_DATA;
        }
        providersData[provider].apiHost = value;
        await storage.setProviders(providersData);
    };

    const onProviderChange = async (value: string) => {
        setSelectedProvider(value);
        setApiKeyValidated(false);
        const providers = await storage.getProviders();
        await storage.setSelectedProvider(value);
        const models = await getModels(value);
        const apiHost = providers[value]?.apiHost || PROVIDERS_DATA[value].apiHost;
        const apiKey = providers[value]?.apiKey;

        const model = providers[value]?.selectedModel || models[0].value;
        const fieldsValue = { apiKey, model, apiHost };

        providers[value] = {
            ...providers[value],
            apiKey,
            apiHost,
            selectedModel: model,
        };

        await storage.setProviders(providers);
        form.setFieldsValue(fieldsValue);
    };

    const onModelChange = async (value: string) => {
        form.setFieldsValue({ model: value });
        await storage.setSelectedModel(value);
    };

    const validateApiHost = async () => {
        if (!isLocalhost(selectedProvider)) {
            const apiKey = form.getFieldValue('apiKey');
            if (!apiKey) {
                message.error(t('pleaseEnterApiKey'));
                return;
            }
        }
        message.loading({
            content: t('validatingApi'),
            key: 'apiKeyValidation',
            duration: 0,
        });
        try {
            await validateApiKey();
            setApiKeyValidated(true);

            message.success({
                content: t('apiValidSuccess'),
                key: 'apiKeyValidation',
            });
        } catch (error) {
            console.error('API key validation error:', error);
            setApiKeyValidated(false);
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
        }
    };

    return (
        <Form
            form={form}
            name="setting"
            className="form"
            layout="vertical"
            requiredMark={false}
            size="large"
        >
            <Form.Item
                className="form-item"
                label={t('serviceProvider')}
                name="provider"
                rules={[{ required: true, message: t('selectProvider') }]}
            >
                <Select
                    placeholder={t('selectProvider')}
                    onChange={onProviderChange}
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
                                onChange={(e) => onApiKeyChange(e.target.value)}
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
            <Form.Item className="form-item" label={t('apiHost')}>
                <Form.Item
                    name="apiHost"
                    noStyle
                    rules={[{ required: true, message: t('enterApiHost') }]}
                >
                    <Input
                        placeholder={t('enterApiHost')}
                        onChange={(e) => onApiHostChange(e.target.value)}
                    />
                </Form.Item>
                <div className="api-link">
                    <Button type="primary" onClick={validateApiHost} style={{ marginLeft: '8px' }}>
                        {apiKeyValidated ? t('validated') : t('validate')}
                    </Button>
                </div>
            </Form.Item>
            <Form.Item
                className="form-item"
                label={t('modelSelection')}
                name="model"
                rules={[{ required: true, message: t('selectModel') }]}
            >
                <Select
                    placeholder={t('selectModel')}
                    onChange={onModelChange}
                    options={models}
                    allowClear
                />
            </Form.Item>
        </Form>
    );
};

export default ApiSettings;
