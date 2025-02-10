import { Button, Form, Input, message, Select, Tooltip, Typography } from 'antd';
import React, { useEffect, useState } from 'react';

import './App.scss';
import storage from '@/utils/storage';
import { validateApiKey } from '@/service';
import { PROVIDERS_DATA } from '@/utils/constant';

const layout = {
    labelCol: { span: 6 },
    wrapperCol: { span: 18 },
};

const { Option } = Select;

const App: React.FC = () => {
    const [form] = Form.useForm();
    const [loadings, setLoadings] = useState<string>('保存配置');
    const [selectedProvider, setSelectedProvider] = useState('DeepSeek');

    useEffect(() => {
        initData();
    }, []);

    const initData = async () => {
        const { selectedProvider, selectedModel } = await storage.getConfig();
        if (!selectedProvider) {
            return;
        }
        setSelectedProvider(selectedProvider);

        const providers = await storage.getProviders();

        form.setFieldsValue({
            provider: selectedProvider,
            apiKey: providers[selectedProvider]?.apiKey || '',
            model: selectedModel,
        });
    };

    const onFinish = async (values: any) => {
        setLoadings('保存配置中');
        const { provider, apiKey, model } = values;

        let providersData = await storage.getProviders();
        if (!providersData) {
            providersData = PROVIDERS_DATA;
        }

        providersData[provider] = { ...PROVIDERS_DATA[provider], apiKey };
        console.log('providersData', providersData);

        await storage.setProviders(providersData);
        await storage.setSelectedProvider(provider);
        console.log('model', model);
        await storage.setSelectedModel(model);
        await storage.updateApiKey(provider, apiKey);
        message.success('配置已保存');
        setLoadings('校验 api 是否正常');
        onValidateApiKey();
    };

    const onProviderChange = async (value: string) => {
        setSelectedProvider(value);
        const providers = await storage.getProviders();
        const apiKey = providers[value]?.apiKey;
        const model = providers[value]?.models[0];
        form.setFieldsValue({ provider: value, apiKey, model: model?.value });
    };

    const onModelChange = (value: string) => {
        form.setFieldsValue({ model: value });
    };

    const onValidateApiKey = async () => {
        try {
            await validateApiKey();
            message.success('Api Key 校验通过，可以正常使用本工具');
            setLoadings('保存配置');
        } catch (error) {
            setLoadings('保存配置');
            if (error instanceof Error) {
                message.error(error.message);
            } else {
                message.error(error as string);
            }
        }
    };

    return (
        <div className="app">
            <h1>工具</h1>
            <Form {...layout} form={form} name="setting" className="form" onFinish={onFinish}>
                <Form.Item
                    label="服务商"
                    name="provider"
                    rules={[{ required: true, message: '请选择服务商' }]}
                >
                    <Select
                        placeholder="请选择服务商"
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
                <Form.Item label="API Key" name="ApiKey">
                    <>
                        <Form.Item
                            name="apiKey"
                            noStyle
                            rules={[{ required: true, message: '请输入您的 API Key' }]}
                        >
                            <Input placeholder="ApiKey 将存储在您的本地" />
                        </Form.Item>
                        <Tooltip title="快速获取 API key">
                            <Typography.Link
                                href={PROVIDERS_DATA[selectedProvider].apiKeyUrl || ''}
                                target="_blank"
                            >
                                获取 API Key
                            </Typography.Link>
                        </Tooltip>
                    </>
                </Form.Item>
                <Form.Item
                    label="模型选择"
                    name="model"
                    rules={[{ required: true, message: '请选择您要使用的模型' }]}
                >
                    <Select
                        placeholder="请选择您要使用的模型"
                        onChange={(value) => onModelChange(value)}
                        allowClear
                    >
                        {PROVIDERS_DATA[selectedProvider].models.map((model) => (
                            <Option key={model.value} value={model.value}>
                                {model.label}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
                    <Button type="primary" htmlType="submit" loading={loadings !== '保存配置'}>
                        {loadings}
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default App;
