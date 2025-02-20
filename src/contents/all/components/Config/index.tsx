import { Button, Form, Select } from 'antd';
import React, { useEffect, useState } from 'react';

import { modelList } from '@/service';
import { isLocalhost } from '@/utils';
import { PROVIDERS_DATA } from '@/utils/constant';
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

    useEffect(() => {
        initData();
    }, []);

    const initData = async () => {
        const { selectedProvider, selectedModel } = await storage.getConfig();
        if (!selectedProvider) {
            return;
        }
        setSelectedProvider(selectedProvider);
        await getModels(selectedProvider);

        const providers = await storage.getProviders();

        form.setFieldsValue({
            provider: selectedProvider,
            apiKey: providers[selectedProvider]?.apiKey || '',
            model: selectedModel,
        });
    };

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

    return (
        <Form {...layout} form={form} name="setting" className="form">
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
            <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
                <Button type="primary" htmlType="submit" loading={loadings !== '保存配置'}>
                    {loadings}
                </Button>
            </Form.Item>
        </Form>
    );
};

export default App;
