import { Form, message, Select } from 'antd';
import { useEffect, useState } from 'react';

import { modelList } from '@/services';
import type { ProviderConfig } from '@/types';
import { isLocalhost } from '@/utils';
import { PROVIDERS_DATA } from '@/utils/constant';
import storage from '@/utils/storage';
import { useLanguage } from '@/contexts/LanguageContext';

const { Option } = Select;

const Config = (props: {
    width: number;
    height: number;
    parentInitData: () => void;
    onCancel: () => void;
}) => {
    const [form] = Form.useForm();
    const [models, setModels] = useState<Array<{ label: string; value: string }>>([]);
    const [configProviders, setConfigProviders] = useState<Record<string, ProviderConfig>>({});
    const [availableProviders, setAvailableProviders] = useState<string[]>([]);
    const { t, currentLanguage } = useLanguage();

    const initData = async () => {
        const providers = await storage.getProviders();
        setConfigProviders(providers);

        // 只过滤出已经设置了 API Key 的服务商
        const providersWithApiKey = Object.keys(providers).filter((key) => {
            console.log('providers', providers);
            console.log('key', key);
            const apiKey = providers[key]?.apiKey;
            console.log('apiKey', apiKey);
            return apiKey !== null && apiKey !== undefined && apiKey.trim() !== '';
        });
        setAvailableProviders(providersWithApiKey);

        const { selectedProvider, selectedModel } = await storage.getConfig();
        if (!selectedProvider) {
            return;
        }

        await getModels(selectedProvider);

        form.setFieldsValue({
            provider: selectedProvider,
            apiKey: providers[selectedProvider]?.apiKey || '',
            model: selectedModel,
        });
    };

    useEffect(() => {
        initData();
    }, []);

    useEffect(() => {
        form.setFieldsValue(form.getFieldsValue());

        const handleLanguageUpdate = () => {
            form.setFieldsValue(form.getFieldsValue());
        };

        window.addEventListener('languageUpdated', handleLanguageUpdate);

        return () => {
            window.removeEventListener('languageUpdated', handleLanguageUpdate);
        };
    }, [currentLanguage, form]);

    const getModels = async (selectedProvider: string | null) => {
        if (!selectedProvider) {
            setModels([]);
            return;
        }

        // 先清空模型列表
        setModels([]);

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
                const providersData = await storage.getProviders();
                providersData[selectedProvider] = {
                    ...PROVIDERS_DATA[selectedProvider],
                    models: models,
                };
                await storage.setProviders(providersData);
            }
        } else {
            const models = PROVIDERS_DATA[selectedProvider].models;
            setModels(models);
        }
    };

    const onProviderChange = async (provider: string) => {
        props.onCancel();

        // 获取提供商数据并设置选中的提供商
        let providersData = await storage.getProviders();
        if (!providersData) {
            providersData = PROVIDERS_DATA;
        }
        const apiKey = providersData[provider]?.apiKey;
        if (!apiKey && provider !== 'Ollama') {
            message.error(t('pleaseInputApiKey'));
            return;
        }

        // 先重置表单中的模型值
        form.resetFields(['model']);

        providersData[provider] = {
            ...PROVIDERS_DATA[provider],
            selected: true,
            apiKey,
        };

        await storage.setProviders(providersData);
        await storage.setSelectedProvider(provider);

        // 获取模型列表
        await getModels(provider);
        const model = providersData[provider]?.selectedModel;

        if (!isLocalhost(provider)) {
            const apiKey = providersData[provider]?.apiKey;
            const fieldsValue = { apiKey, model };
            form.setFieldsValue(fieldsValue);
        } else {
            const fieldsValue = { model };
            form.setFieldsValue(fieldsValue);
        }
    };

    const onModelChange = async (value: string) => {
        const providersData = await storage.getProviders();
        const selectedProvider = await storage.getSelectedProvider();
        if (!selectedProvider) {
            return;
        }

        props.onCancel();
        form.setFieldsValue({ model: value });

        await storage.setSelectedModel(value);

        providersData[selectedProvider] = {
            ...PROVIDERS_DATA[selectedProvider],
            selectedModel: value,
        };
        await storage.setProviders(providersData);
    };

    return (
        <div
            style={{
                margin: '8px 0',
            }}
        >
            <Form form={form} layout="inline" style={{ marginLeft: 20 }}>
                <Form.Item
                    label={t('serviceProvider')}
                    name="provider"
                    rules={[{ message: t('selectProvider') }]}
                    tooltip={{
                        title: t('selectProvider'),
                        getPopupContainer: (trigger) =>
                            trigger.parentElement?.parentElement?.parentElement || document.body,
                    }}
                >
                    <Select
                        placeholder={t('selectProvider')}
                        onChange={(value) => onProviderChange(value)}
                        allowClear
                        getPopupContainer={(trigger) => trigger.parentElement || document.body}
                        style={{ width: props.width / 4 }}
                    >
                        {availableProviders.map((key) => (
                            <Option key={key} value={key}>
                                {configProviders[key]?.name || key}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item
                    label={t('modelSelection')}
                    name="model"
                    rules={[{ message: t('selectModel') }]}
                >
                    <Select
                        placeholder={t('selectModel')}
                        onChange={(value) => onModelChange(value)}
                        options={models}
                        allowClear
                        getPopupContainer={(trigger) => trigger.parentElement || document.body}
                        style={{ width: props.width / 4 }}
                    />
                </Form.Item>
            </Form>
        </div>
    );
};

export default Config;
