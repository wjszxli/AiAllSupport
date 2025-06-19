import React, { useEffect, useState } from 'react';
import { Form, Select, Button, Card, Tabs, message, Spin, Typography, Alert } from 'antd';
import {
    AppstoreOutlined,
    MessageOutlined,
    WindowsOutlined,
    LayoutOutlined,
    SaveOutlined,
    InfoCircleOutlined,
} from '@ant-design/icons';
import { t } from '@/locales/i18n';
import { Model, Provider } from '@/types';
import { indexedDBStorage } from '@/utils/indexedDBStorage';
import './index.scss';

const { TabPane } = Tabs;
const { Option } = Select;
const { Title, Text } = Typography;

// 模型类型定义
export enum ModelType {
    CHAT = 'chat',
    POPUP = 'popup',
    SIDEBAR = 'sidebar',
}

// 模型配置接口
interface ModelConfig {
    providerId: string;
    modelId: string;
    type: ModelType;
}

const ModelSettings: React.FC = () => {
    const [form] = Form.useForm();
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [modelConfigs, setModelConfigs] = useState<Record<ModelType, ModelConfig>>({
        [ModelType.CHAT]: { providerId: '', modelId: '', type: ModelType.CHAT },
        [ModelType.POPUP]: { providerId: '', modelId: '', type: ModelType.POPUP },
        [ModelType.SIDEBAR]: { providerId: '', modelId: '', type: ModelType.SIDEBAR },
    });
    const [selectedProviders, setSelectedProviders] = useState<Record<ModelType, string>>({
        [ModelType.CHAT]: '',
        [ModelType.POPUP]: '',
        [ModelType.SIDEBAR]: '',
    });
    const [availableModels, setAvailableModels] = useState<Record<string, Model[]>>({});

    // 加载提供商和模型数据
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // 从 indexedDB 获取提供商列表
                const storedProviders = (await indexedDBStorage.getItem('providers')) as Provider[];
                if (storedProviders && storedProviders.length > 0) {
                    setProviders(storedProviders);

                    // 为每个提供商获取可用模型
                    const models: Record<string, Model[]> = {};
                    for (const provider of storedProviders) {
                        if (provider.models && provider.models.length > 0) {
                            models[provider.id] = provider.models;
                        }
                    }
                    setAvailableModels(models);
                } else {
                    message.warning(t('noProvidersConfigured'));
                }

                // 从 indexedDB 获取已保存的模型配置
                const savedConfigs = (await indexedDBStorage.getItem('modelConfigs')) as Record<
                    ModelType,
                    ModelConfig
                >;
                if (savedConfigs) {
                    setModelConfigs(savedConfigs);

                    // 设置选中的提供商
                    const selectedProvs = {
                        [ModelType.CHAT]: savedConfigs[ModelType.CHAT]?.providerId || '',
                        [ModelType.POPUP]: savedConfigs[ModelType.POPUP]?.providerId || '',
                        [ModelType.SIDEBAR]: savedConfigs[ModelType.SIDEBAR]?.providerId || '',
                    };
                    setSelectedProviders(selectedProvs);

                    // 设置表单初始值
                    form.setFieldsValue({
                        [`${ModelType.CHAT}_provider`]: savedConfigs[ModelType.CHAT]?.providerId,
                        [`${ModelType.CHAT}_model`]: savedConfigs[ModelType.CHAT]?.modelId,
                        [`${ModelType.POPUP}_provider`]: savedConfigs[ModelType.POPUP]?.providerId,
                        [`${ModelType.POPUP}_model`]: savedConfigs[ModelType.POPUP]?.modelId,
                        [`${ModelType.SIDEBAR}_provider`]:
                            savedConfigs[ModelType.SIDEBAR]?.providerId,
                        [`${ModelType.SIDEBAR}_model`]: savedConfigs[ModelType.SIDEBAR]?.modelId,
                    });
                }
            } catch (error) {
                console.error('Failed to load model settings:', error);
                message.error(t('failedToLoadModelSettings'));
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [form]);

    // 处理提供商变更
    const handleProviderChange = (value: string, type: ModelType) => {
        setSelectedProviders((prev) => ({
            ...prev,
            [type]: value,
        }));

        // 清除已选择的模型
        form.setFieldsValue({
            [`${type}_model`]: undefined,
        });
    };

    // 保存配置
    const handleSave = async () => {
        try {
            const values = await form.validateFields();

            // 构建新的模型配置
            const newConfigs: Record<ModelType, ModelConfig> = {
                [ModelType.CHAT]: {
                    providerId: values[`${ModelType.CHAT}_provider`],
                    modelId: values[`${ModelType.CHAT}_model`],
                    type: ModelType.CHAT,
                },
                [ModelType.POPUP]: {
                    providerId: values[`${ModelType.POPUP}_provider`],
                    modelId: values[`${ModelType.POPUP}_model`],
                    type: ModelType.POPUP,
                },
                [ModelType.SIDEBAR]: {
                    providerId: values[`${ModelType.SIDEBAR}_provider`],
                    modelId: values[`${ModelType.SIDEBAR}_model`],
                    type: ModelType.SIDEBAR,
                },
            };

            // 保存到 indexedDB
            await indexedDBStorage.setItem('modelConfigs', newConfigs);
            setModelConfigs(newConfigs);

            message.success(t('modelSettingsSaved'));
        } catch (error) {
            console.error('Failed to save model settings:', error);
            message.error(t('failedToSaveModelSettings'));
        }
    };

    // 获取模型类型对应的图标
    const getModelIcon = (type: ModelType) => {
        switch (type) {
            case ModelType.CHAT:
                return <MessageOutlined />;
            case ModelType.POPUP:
                return <WindowsOutlined />;
            case ModelType.SIDEBAR:
                return <LayoutOutlined />;
            default:
                return <AppstoreOutlined />;
        }
    };

    // 渲染模型配置表单
    const renderModelConfigForm = (type: ModelType) => {
        const typeLabel =
            type === ModelType.CHAT
                ? t('chatModel')
                : type === ModelType.POPUP
                ? t('popupModel')
                : t('sidebarModel');

        const typeDescription =
            type === ModelType.CHAT
                ? t('chatModelDescription')
                : type === ModelType.POPUP
                ? t('popupModelDescription')
                : t('sidebarModelDescription');

        return (
            <div className="model-config-section">
                <div className="model-header">
                    <div className="model-icon">{getModelIcon(type)}</div>
                    <Title level={4}>{typeLabel}</Title>
                </div>

                <Text type="secondary" className="model-description">
                    {typeDescription}
                </Text>

                <Form.Item
                    name={`${type}_provider`}
                    label={t('modelProvider')}
                    rules={[{ required: true, message: t('selectProviderFirst') }]}
                >
                    <Select
                        placeholder={t('selectProviderFirst')}
                        onChange={(value) => handleProviderChange(value, type)}
                        className="provider-select"
                        showSearch
                        optionFilterProp="children"
                    >
                        {providers.map((provider) => (
                            <Option key={provider.id} value={provider.id}>
                                {provider.name}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name={`${type}_model`}
                    label={t('modelName')}
                    rules={[{ required: true, message: t('selectModelFirst') }]}
                >
                    <Select
                        placeholder={t('selectModelFirst')}
                        disabled={!selectedProviders[type]}
                        className="model-select"
                        showSearch
                        optionFilterProp="children"
                    >
                        {selectedProviders[type] &&
                            availableModels[selectedProviders[type]]?.map((model) => (
                                <Option key={model.id} value={model.id}>
                                    {model.name}
                                </Option>
                            ))}
                    </Select>
                </Form.Item>
            </div>
        );
    };

    if (loading) {
        return <Spin size="large" className="model-settings-loading" />;
    }

    return (
        <div className="model-settings">
            <Card className="model-settings-card">
                <Form form={form} layout="vertical">
                    <Tabs
                        defaultActiveKey="chat"
                        centered
                        size="large"
                        tabBarStyle={{ marginBottom: 24 }}
                    >
                        <TabPane
                            tab={
                                <span className="tab-item">
                                    <MessageOutlined
                                        style={{ fontSize: '18px', marginRight: '8px' }}
                                    />
                                    {t('chatModel')}
                                </span>
                            }
                            key="chat"
                        >
                            {renderModelConfigForm(ModelType.CHAT)}
                        </TabPane>
                        <TabPane
                            tab={
                                <span className="tab-item">
                                    <WindowsOutlined
                                        style={{ fontSize: '18px', marginRight: '8px' }}
                                    />
                                    {t('popupModel')}
                                </span>
                            }
                            key="popup"
                        >
                            {renderModelConfigForm(ModelType.POPUP)}
                        </TabPane>
                        <TabPane
                            tab={
                                <span className="tab-item">
                                    <LayoutOutlined
                                        style={{ fontSize: '18px', marginRight: '8px' }}
                                    />
                                    {t('sidebarModel')}
                                </span>
                            }
                            key="sidebar"
                        >
                            {renderModelConfigForm(ModelType.SIDEBAR)}
                        </TabPane>
                    </Tabs>

                    <Form.Item className="save-button-container">
                        <Button
                            type="primary"
                            onClick={handleSave}
                            icon={<SaveOutlined />}
                            size="large"
                        >
                            {t('save')}
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default ModelSettings;
