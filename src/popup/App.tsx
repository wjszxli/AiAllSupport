import { Button, Form, Input, message, Select, Switch, Tooltip, Typography } from 'antd';
import React, { useEffect, useState } from 'react';

import { modelList, validateApiKey } from '@/service';
import { isLocalhost } from '@/utils';
import { GIT_URL, PROVIDERS_DATA, SHORTCUTS_URL } from '@/utils/constant';
import storage from '@/utils/storage';

import './App.scss';

const layout = {
    labelCol: { span: 6 },
    wrapperCol: { span: 18 },
};

const { Option } = Select;

const App: React.FC = () => {
    const [form] = Form.useForm();
    const [loadings, setLoadings] = useState<string>('保存配置');
    const [selectedProvider, setSelectedProvider] = useState('DeepSeek');
    const [models, setModels] = useState<Array<{ label: string; value: string }>>([]);

    const initData = async () => {
        const { selectedProvider, selectedModel } = await storage.getConfig();
        if (!selectedProvider) {
            return;
        }
        const isIcon = await storage.getIsChatBoxIcon();
        setSelectedProvider(selectedProvider);
        await getModels(selectedProvider);

        const providers = await storage.getProviders();
        console.log('isIcon', isIcon);

        form.setFieldsValue({
            provider: selectedProvider,
            apiKey: providers[selectedProvider]?.apiKey || '',
            model: selectedModel,
            isIcon,
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
            }
        } else {
            const models = PROVIDERS_DATA[selectedProvider].models;
            setModels(models);
        }
    };

    const onFinish = async (values: any) => {
        console.log('values', values);
        setLoadings('保存配置中');
        const { provider, apiKey, model, isIcon } = values;

        let providersData = await storage.getProviders();
        if (!providersData) {
            providersData = PROVIDERS_DATA;
        }

        providersData[provider] = { ...PROVIDERS_DATA[provider], apiKey };

        await storage.setProviders(providersData);
        await storage.setSelectedProvider(provider);
        await storage.setSelectedModel(model);
        await storage.updateApiKey(provider, apiKey);
        await storage.setIsChatBoxIcon(isIcon);
        message.success('配置已保存');
        setLoadings('校验 api 是否正常');
        onValidateApiKey();
    };

    const onProviderChange = async (value: string) => {
        setSelectedProvider(value);
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

    const onSetShortcuts = () => {
        chrome.tabs.create({
            url: SHORTCUTS_URL,
        });
    };

    return (
        <div className="app">
            <h1>AI 工具</h1>
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
                {!isLocalhost(selectedProvider) && (
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
                )}

                <Form.Item
                    label="模型选择"
                    name="model"
                    rules={[{ required: true, message: '请选择您要使用的模型' }]}
                >
                    <Select
                        placeholder="请选择您要使用的模型"
                        onChange={(value) => onModelChange(value)}
                        options={models}
                        allowClear
                    />
                </Form.Item>
                <Form.Item
                    label="是否选中文本出现图标"
                    name="isIcon"
                    rules={[{ required: true, message: '请选择是否选中文本出现图标' }]}
                >
                    <Switch
                        defaultChecked
                        onChange={(value) => form.setFieldValue('isIcon', value)}
                    />
                </Form.Item>
                <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
                    <Button type="primary" htmlType="submit" loading={loadings !== '保存配置'}>
                        {loadings}
                    </Button>
                </Form.Item>
            </Form>
            <Typography.Link onClick={onSetShortcuts} style={{ padding: 20 }}>
                设置快捷键
            </Typography.Link>
            <Typography.Link href={GIT_URL} target="_blank" style={{ padding: 20 }}>
                给作者点赞 ｜ 联系作者
            </Typography.Link>
        </div>
    );
};

export default App;
