import React, { useMemo, useState, useEffect } from 'react';
import { Tabs, Typography, Select, message, Button, Space } from 'antd';
import {
    MessageOutlined,
    WindowsOutlined,
    LayoutOutlined,
    PlusOutlined,
    RobotOutlined,
} from '@ant-design/icons';
import { t } from '@/locales/i18n';
import { observer } from 'mobx-react';
import { useStore } from '@/store';
import './index.scss';
import { ConfigModelType, Provider, Model, Robot } from '@/types';
import robotStore from '@/store/robot';
import AddRobotModal from '@/components/AddRobotModal';

const { TabPane } = Tabs;
const { Title, Text } = Typography;

interface ModelSettingsProps {
    activeKey?: string;
    onTabChange?: (key: string) => void;
}

const ModelSettings: React.FC<ModelSettingsProps> = observer(({ activeKey, onTabChange }) => {
    const { llmStore } = useStore();
    const [selectedModels, setSelectedModels] = useState<Record<ConfigModelType, string>>({
        [ConfigModelType.CHAT]: '',
        [ConfigModelType.POPUP]: '',
        [ConfigModelType.SIDEBAR]: '',
    });
    const [selectedRobots, setSelectedRobots] = useState<Record<ConfigModelType, string>>({
        [ConfigModelType.CHAT]: '',
        [ConfigModelType.POPUP]: '',
        [ConfigModelType.SIDEBAR]: '',
    });
    const [loading, setLoading] = useState(true);
    const [addRobotModalVisible, setAddRobotModalVisible] = useState(false);

    // 组件加载时，初始化已选择的模型和机器人
    useEffect(() => {
        const initializeSettings = async () => {
            try {
                // 初始化机器人
                await robotStore.initializeFromDB();

                const newSelectedModels = { ...selectedModels };
                const newSelectedRobots = { ...selectedRobots };

                // 获取每种界面类型的模型
                for (const type of Object.values(ConfigModelType)) {
                    const model = llmStore.getModelForType(type);
                    if (model) {
                        // 使用 provider#modelId 格式作为值
                        newSelectedModels[type] = `${model.provider}#${model.id}`;
                    }
                }

                // 获取每种界面类型的机器人
                for (const type of Object.values(ConfigModelType)) {
                    const robot = llmStore.getRobotForType(type);
                    if (robot?.id) {
                        // 验证机器人是否仍然存在于机器人列表中
                        const robotExists = robotStore.robotList.find((r) => r.id === robot.id);
                        if (robotExists) {
                            newSelectedRobots[type] = robot.id;
                        } else {
                            // 如果机器人不存在，清除配置
                            llmStore.setRobotForType(type, null);
                        }
                    }

                    // 如果没有配置或机器人不存在，使用默认的选中机器人
                    if (!newSelectedRobots[type] && robotStore.selectedRobot?.id) {
                        newSelectedRobots[type] = robotStore.selectedRobot.id;
                        llmStore.setRobotForType(type, robotStore.selectedRobot);
                    }
                }

                setSelectedModels(newSelectedModels);
                setSelectedRobots(newSelectedRobots);
            } catch (error) {
                console.error('Failed to initialize settings:', error);
                message.error(t('failedToLoadModelSettings'));
            } finally {
                setLoading(false);
            }
        };

        initializeSettings();
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

    // 获取机器人选项
    const robotOptions = useMemo(() => {
        return robotStore.robotList.map((robot: Robot) => ({
            label: robot.name,
            value: robot.id,
        }));
    }, [robotStore.robotList]);

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

    // 处理机器人选择
    const handleRobotChange = async (value: string, type: ConfigModelType) => {
        setSelectedRobots((prev) => ({ ...prev, [type]: value }));

        const robot = robotStore.robotList.find((r: Robot) => r.id === value);
        if (!robot) {
            message.error('机器人未找到');
            return;
        }

        // 保存机器人配置到对应的界面类型
        llmStore.setRobotForType(type, robot);

        // 立即验证存储是否成功
        await new Promise((resolve) => setTimeout(resolve, 100));
        const savedRobot = llmStore.getRobotForType(type);

        if (savedRobot?.id === robot.id) {
            message.success(`${robot.name} 已设置为${getTypeLabel(type)}机器人`);
        } else {
            console.error('Robot configuration not saved correctly', {
                expected: robot.id,
                actual: savedRobot?.id,
            });
            message.error('机器人配置保存失败，请重试');
        }
    };

    // 获取类型标签
    const getTypeLabel = (type: ConfigModelType) => {
        const labels = {
            [ConfigModelType.CHAT]: '聊天界面',
            [ConfigModelType.POPUP]: '弹窗界面',
            [ConfigModelType.SIDEBAR]: '侧边栏界面',
        };
        return labels[type];
    };

    // 处理添加机器人
    const handleAddRobot = () => {
        setAddRobotModalVisible(true);
    };

    const handleAddRobotModalCancel = () => {
        setAddRobotModalVisible(false);
    };

    return (
        <div className="model-settings">
            <Tabs
                activeKey={activeKey || ConfigModelType.CHAT}
                onChange={onTabChange}
                size="large"
                tabBarStyle={{ marginBottom: 24 }}
            >
                {tabConfigs.map((tab) => (
                    <TabPane
                        tab={
                            <span className="tab-item" id={`tour-${tab.type}-tab`}>
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
                                id={`tour-${tab.type}-model-select`}
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

                            {/* 机器人选择区域 */}
                            <div className="robot-selection-section">
                                <div className="robot-header">
                                    <RobotOutlined style={{ marginRight: '8px' }} />
                                    <Typography.Title level={5} style={{ margin: 0 }}>
                                        聊天机器人
                                    </Typography.Title>
                                </div>
                                <Text type="secondary" className="robot-description">
                                    选择用于此界面的聊天机器人
                                </Text>
                                <Space.Compact style={{ width: '100%' }}>
                                    <Select
                                        placeholder="选择机器人"
                                        className="robot-select"
                                        size="large"
                                        showSearch
                                        optionFilterProp="label"
                                        options={robotOptions}
                                        value={selectedRobots[tab.type] || undefined}
                                        onChange={(value) => handleRobotChange(value, tab.type)}
                                        loading={loading}
                                        disabled={loading}
                                        style={{ flex: 1 }}
                                    />
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        size="large"
                                        onClick={handleAddRobot}
                                        disabled={loading}
                                        title="添加新机器人"
                                    />
                                </Space.Compact>
                            </div>
                        </div>
                    </TabPane>
                ))}
            </Tabs>

            {/* 添加机器人弹窗 */}
            <AddRobotModal
                isVisible={addRobotModalVisible}
                onCancel={handleAddRobotModalCancel}
                loading={loading}
            />
        </div>
    );
});

export default ModelSettings;
