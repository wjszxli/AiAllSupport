import { Form, Select } from 'antd';
import { useEffect, useState } from 'react';

import { modelList } from '@/service';
import type { ProviderConfig } from '@/typings';
import { isLocalhost } from '@/utils';
import { PROVIDERS_DATA } from '@/utils/constant';
import storage from '@/utils/storage';

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

    const initData = async () => {
        const providers = await storage.getProviders();
        setConfigProviders(providers);

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

    const onProviderChange = async (value: string) => {
        props.onCancel();
        const providers = await storage.getProviders();
        await storage.setSelectedProvider(value);
        await getModels(value);
        if (!isLocalhost(value)) {
            const apiKey = providers[value]?.apiKey;
            const model = providers[value]?.models[0].value;
            const fieldsValue = { apiKey, model };
            form.setFieldsValue(fieldsValue);
            await storage.setSelectedModel(model);
        } else {
            const model = providers[value]?.models[0].value;
            form.setFieldsValue({ model });
            await storage.setSelectedModel(model);
        }
    };

    const onModelChange = async (value: string) => {
        props.onCancel();
        form.setFieldsValue({ model: value });
        await storage.setSelectedModel(value);
    };

    return (
        <Form form={form} layout="inline" style={{ marginLeft: 20 }}>
            <Form.Item
                label="服务商"
                name="provider"
                rules={[{ message: '请选择服务商' }]}
                tooltip={{
                    title: 'This is a required field',
                    getPopupContainer: (trigger) =>
                        trigger.parentElement?.parentElement?.parentElement || document.body,
                }}
            >
                <Select
                    placeholder="请选择服务商"
                    onChange={(value) => onProviderChange(value)}
                    allowClear
                    getPopupContainer={(trigger) => trigger.parentElement || document.body}
                    style={{ width: props.width / 4 }}
                >
                    {(Object.keys(configProviders) as Array<keyof typeof configProviders>).map(
                        (key) => (
                            <Option key={key} value={key}>
                                {configProviders[key].name}
                            </Option>
                        ),
                    )}
                </Select>
            </Form.Item>
            <Form.Item label="模型" name="model" rules={[{ message: '请选择您要使用的模型' }]}>
                <Select
                    placeholder="请选择您要使用的模型"
                    onChange={(value) => onModelChange(value)}
                    options={models}
                    allowClear
                    getPopupContainer={(trigger) => trigger.parentElement || document.body}
                    style={{ width: props.width / 4 }}
                />
            </Form.Item>
        </Form>
    );
};

export default Config;
