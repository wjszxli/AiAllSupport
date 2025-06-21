import React, { useMemo, useState, useEffect } from 'react';
import { Tabs, Typography, Select, message } from 'antd';
import { MessageOutlined, WindowsOutlined, LayoutOutlined } from '@ant-design/icons';
import { t } from '@/locales/i18n';
import { observer } from 'mobx-react';
import { useStore } from '@/store';
import './index.scss';
import { ConfigModelType, Provider, Model } from '@/types';

const { TabPane } = Tabs;
const { Title, Text } = Typography;

const ModelSettings: React.FC = observer(() => {
    const { llmStore } = useStore();
    const [selectedModels, setSelectedModels] = useState<Record<ConfigModelType, string>>({
        [ConfigModelType.CHAT]: '',
        [ConfigModelType.POPUP]: '',
        [ConfigModelType.SIDEBAR]: '',
    });
    const [loading, setLoading] = useState(true);

    // 组件加载时，初始化已选择的模型
    useEffect(() => {
        const initializeSelectedModels = () => {
            try {
                const newSelectedModels = { ...selectedModels };

                // 获取每种界面类型的模型
                for (const type of Object.values(ConfigModelType)) {
                    const model = llmStore.getModelForType(type);
                    if (model) {
                        // 使用 provider:modelId 格式作为值
                        newSelectedModels[type] = `${model.provider}:${model.id}`;
                    }
                }

                setSelectedModels(newSelectedModels);
            } catch (error) {
                console.error('Failed to initialize model settings:', error);
                message.error(t('failedToLoadModelSettings'));
            } finally {
                setLoading(false);
            }
        };

        initializeSelectedModels();
    }, []);

    const tabConfigs = [
        { type: ConfigModelType.CHAT, label: t('chatModel') },
        { type: ConfigModelType.POPUP, label: t('popupModel') },
        { type: ConfigModelType.SIDEBAR, label: t('sidebarModel') },
    ];

    const getModelIcon = (type: ConfigModelType) => {
        const icons: Record<ConfigModelType, React.ReactNode> = {
            [ConfigModelType.CHAT]: (
                <MessageOutlined style={{ fontSize: '18px', marginRight: '8px' }} />
            ),
            [ConfigModelType.POPUP]: (
                <WindowsOutlined style={{ fontSize: '18px', marginRight: '8px' }} />
            ),
            [ConfigModelType.SIDEBAR]: (
                <LayoutOutlined style={{ fontSize: '18px', marginRight: '8px' }} />
            ),
        };
        return icons[type];
    };

    const getFilteredModelOptions = useMemo(() => {
        const providersWithApiKey = llmStore.providers.filter(
            (provider) => provider.apiKey || provider.requiresApiKey === false,
        );

        // 将提供商转换为模型选项
        const getProviderModelOptions = (providers: Provider[]) => {
            const result: { label: string; options: { label: string; value: string }[] }[] = [];

            providers.forEach((provider: Provider) => {
                if (provider.models.length > 0) {
                    const options = provider.models.map((model: Model) => ({
                        label: `${model.name} - (${model.group})`,
                        value: `${provider.id}#${model.id}`, // 使用 provider:model 格式作为值
                    }));

                    result.push({
                        label: provider.name,
                        options,
                    });
                }
            });

            return result;
        };

        return getProviderModelOptions(providersWithApiKey);
    }, [llmStore.providers]);

    // 获取模型对象
    const getModelFromValue = (value: string) => {
        const [providerId, modelId] = value.split('#');

        // 查找提供商和模型
        const provider = llmStore.providers.find((p) => p.id === providerId);
        if (!provider) {
            message.error(`Provider ${providerId} not found`);
            return null;
        }

        const model = provider.models.find((m) => m.id === modelId);
        if (!model) {
            message.error(`Model ${modelId} not found in provider ${providerId}`);
            return null;
        }

        return model;
    };

    // 处理模型选择
    const handleModelChange = async (value: string, type: ConfigModelType) => {
        setSelectedModels((prev) => ({ ...prev, [type]: value }));

        const model = getModelFromValue(value);
        if (!model) return;

        // 使用 llmStore 的新方法设置特定场景的模型
        llmStore.setModelForType(type, model);
        message.success(t('modelSettingsSaved'));

        if (chrome && chrome.runtime) {
            const [providerId, _] = value.split('#');
            try {
                await chrome.runtime.sendMessage({
                    action: 'providerSettingsUpdated',
                    provider: providerId,
                    timestamp: Date.now(),
                });
            } catch (error) {
                console.error('Failed to notify about provider settings update:', error);
            }
        }
    };

    return (
        <div className="model-settings">
            <Tabs
                defaultActiveKey={ConfigModelType.CHAT}
                size="large"
                tabBarStyle={{ marginBottom: 24 }}
            >
                {tabConfigs.map((tab) => (
                    <TabPane
                        tab={
                            <span className="tab-item">
                                {getModelIcon(tab.type)}
                                {tab.label}
                            </span>
                        }
                        key={tab.type}
                    >
                        <div className="model-config-section">
                            <div className="model-header">
                                <div className="model-icon">{getModelIcon(tab.type)}</div>
                                <Title level={4}>{tab.label}</Title>
                            </div>

                            <Text type="secondary" className="model-description">
                                {t(`${tab.type}ModelDescription`)}
                            </Text>
                            <Select
                                placeholder={t('selectModelFirst')}
                                className="model-select"
                                size="large"
                                showSearch
                                optionFilterProp="label"
                                options={getFilteredModelOptions}
                                value={selectedModels[tab.type] || undefined}
                                onChange={(value) => handleModelChange(value, tab.type)}
                                loading={loading}
                                disabled={loading}
                            />
                        </div>
                    </TabPane>
                ))}
            </Tabs>
        </div>
    );
});

export default ModelSettings;
