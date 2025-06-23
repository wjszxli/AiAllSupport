import { Avatar, Button, Form, Input, message, Modal, Select, Space, Card, Typography } from 'antd';
import React, { useState, useEffect } from 'react';
import { GlobalOutlined, KeyOutlined, CodeOutlined, CheckCircleOutlined } from '@ant-design/icons';

import { t } from '@/locales/i18n';
import { isLocalhost } from '@/utils';
import { Provider } from '@/types';
import { getProviderLogo, PROVIDER_CONFIG } from '@/config/providers';
import LangChainService from '@/langchain/services/LangChainService';
import { getProviderName } from '@/utils/i18n';
import { getModelGroupOptions } from '@/utils';
import llmStore from '@/store/llm';

const { Text } = Typography;

interface ConfigModalProps {
    isModalOpen: boolean;
    onCancel: () => void;
    onOk: () => void;
    selectProviderId: string;
}

const ConfigModal: React.FC<ConfigModalProps> = ({
    isModalOpen,
    selectProviderId,
    onCancel,
    onOk,
}) => {
    const [apiKeyValidated, setApiKeyValidated] = useState<boolean>(false);
    const [testing, setTesting] = useState<boolean>(false);
    const currentProvider = llmStore.providers.find((p: Provider) => p.id === selectProviderId);
    const [form] = Form.useForm();

    const requiresApiKey = currentProvider?.requiresApiKey !== false;

    const initializeSelectedModels = async () => {
        if (
            currentProvider &&
            (currentProvider.models.length === 0 || isLocalhost(currentProvider.id))
        ) {
            const models = await LangChainService.getModels({
                ...currentProvider,
                apiKey: currentProvider.apiKey || 'xxx',
                apiHost: currentProvider.apiHost,
            });

            currentProvider.models = models;
            llmStore.updateProvider({
                ...currentProvider,
                models,
            });
        }
    };

    useEffect(() => {
        if (isModalOpen && currentProvider) {
            initializeSelectedModels();
            let defaultModelId = currentProvider.selectedModel?.id;

            if (!defaultModelId && currentProvider.models && currentProvider.models.length > 0) {
                defaultModelId = currentProvider.models[0].id;
            }

            // 设置表单值
            form.setFieldsValue({
                apiKey: currentProvider.apiKey || '',
                apiHost: currentProvider.apiHost || '',
                model: defaultModelId,
            });
        }
    }, [isModalOpen, selectProviderId]);

    const validateApiHost = async () => {
        if (!currentProvider) return;

        setTesting(true);

        try {
            const apiKey = form.getFieldValue('apiKey');
            const apiHost = form.getFieldValue('apiHost');
            const selectedModelId = form.getFieldValue('model');

            if (requiresApiKey && !isLocalhost(currentProvider.id) && !apiKey) {
                message.error(t('pleaseEnterApiKey'));
                setTesting(false);
                return;
            }

            const model =
                currentProvider.models.find((m) => m.id === selectedModelId) ||
                currentProvider.models[0];

            const newProvider = {
                ...currentProvider,
                apiKey,
                apiHost,
                selectedModel: model,
            };

            llmStore.updateProvider(newProvider);

            const { valid, error } = await LangChainService.checkApiProvider(newProvider);

            if (valid) {
                setApiKeyValidated(true);
                message.success(t('apiValidSuccess'));
            } else {
                setApiKeyValidated(false);
                message.error(error?.message || t('apiValidFailed'));
            }
        } catch (error) {
            console.error('API 验证错误:', error);
            setApiKeyValidated(false);

            if (error instanceof Error) {
                message.error(error.message);
            } else {
                message.error(String(error));
            }
        } finally {
            setTesting(false);
        }
    };

    const onUpdateApiHost = () => {
        const { apiHost } = form.getFieldsValue();
        if (!currentProvider) return;
        llmStore.updateProvider({ ...currentProvider, apiHost });
    };

    const onModelChange = (modelId: string) => {
        if (!currentProvider) return;
        const model = currentProvider.models.find((m) => m.id === modelId);
        if (model) {
            llmStore.updateProvider({
                ...currentProvider,
                selectedModel: model,
            });
        }
    };

    const handleOk = async () => {
        const { apiKey, apiHost, model: selectedModelId } = form.getFieldsValue();

        if (currentProvider && !apiHost) {
            message.error(t('pleaseEnterApiHost'));
            return;
        }

        if (currentProvider && requiresApiKey && !isLocalhost(currentProvider.id) && !apiKey) {
            message.error(t('pleaseEnterApiKey'));
            return;
        }

        if (currentProvider && selectedModelId) {
            const model = currentProvider.models.find((m) => m.id === selectedModelId);
            if (model) {
                llmStore.updateProvider({
                    ...currentProvider,
                    apiKey,
                    apiHost,
                    selectedModel: model,
                });
            }
        }

        if (chrome && chrome.runtime) {
            try {
                if (currentProvider) {
                    await chrome.runtime.sendMessage({
                        action: 'providerSettingsUpdated',
                        provider: currentProvider.id,
                        timestamp: Date.now(),
                    });
                }
            } catch (error) {
                console.error('Failed to notify about provider settings update:', error);
            }
        }
        onOk();
        setApiKeyValidated(false);
    };

    // @ts-ignore
    const providerConfig = (PROVIDER_CONFIG as any)[currentProvider?.id] || {};
    const officialWebsite = providerConfig?.websites?.official;
    const apiKeyWebsite = providerConfig?.websites?.apiKey;
    const modelsPage = providerConfig?.websites?.models;
    const docs = providerConfig?.websites?.docs;

    return (
        <Modal
            title={
                currentProvider && (
                    <Space>
                        <Avatar size="small" src={getProviderLogo(currentProvider.id)} />
                        {`配置 ${getProviderName(currentProvider)}`}
                    </Space>
                )
            }
            open={isModalOpen}
            onOk={handleOk}
            onCancel={() => {
                onCancel();
                setApiKeyValidated(false);
            }}
            width={600}
            footer={[
                <Button
                    key="test"
                    type="default"
                    onClick={validateApiHost}
                    loading={testing}
                    icon={apiKeyValidated ? <CheckCircleOutlined /> : null}
                >
                    {testing ? '测试中...' : apiKeyValidated ? '连接成功' : '测试连接'}
                </Button>,
                <Button
                    key="cancel"
                    onClick={() => {
                        onCancel();
                        setApiKeyValidated(false);
                    }}
                >
                    取消
                </Button>,
                <Button key="save" type="primary" onClick={handleOk}>
                    保存
                </Button>,
            ]}
        >
            <Form form={form} layout="vertical" requiredMark={false}>
                {!currentProvider || (!isLocalhost(currentProvider.id) && requiresApiKey) ? (
                    <Form.Item
                        label={
                            <Space>
                                <KeyOutlined />
                                <span>API 密钥</span>
                            </Space>
                        }
                        tooltip="您的密钥仅存储在本地，请放心填写"
                    >
                        <Form.Item
                            name="apiKey"
                            rules={[
                                {
                                    required: requiresApiKey,
                                    message: '请输入 API 密钥',
                                },
                            ]}
                            noStyle
                        >
                            <Input.Password placeholder="您的密钥存储在您本地，请放心填写" />
                        </Form.Item>
                        {apiKeyWebsite && (
                            <Button
                                icon={<KeyOutlined />}
                                type="link"
                                href={apiKeyWebsite}
                                target="_blank"
                                style={{ textAlign: 'left', padding: 0 }}
                            >
                                获取 API 密钥
                            </Button>
                        )}
                    </Form.Item>
                ) : null}

                <Form.Item
                    label={
                        <Space>
                            <GlobalOutlined />
                            <span>API 地址</span>
                        </Space>
                    }
                    name="apiHost"
                    rules={[{ required: true, message: '请输入 API 地址' }]}
                    tooltip="如果不确定，请保留默认值"
                >
                    <Input placeholder="请输入 API 地址" onBlur={onUpdateApiHost} />
                </Form.Item>

                <Form.Item
                    label={
                        <Space>
                            <CodeOutlined />
                            <span>默认模型</span>
                        </Space>
                    }
                    name="model"
                    rules={[{ required: true, message: '请选择默认模型' }]}
                >
                    <Select
                        placeholder="请选择默认模型"
                        options={getModelGroupOptions(currentProvider?.models)}
                        onChange={onModelChange}
                    />
                </Form.Item>
            </Form>
            <div>
                {officialWebsite && (
                    <Button
                        icon={<GlobalOutlined />}
                        type="link"
                        href={officialWebsite}
                        target="_blank"
                        style={{ textAlign: 'left' }}
                    >
                        官网
                    </Button>
                )}
                {docs && (
                    <Button
                        icon={<CodeOutlined />}
                        type="link"
                        href={docs}
                        target="_blank"
                        style={{ textAlign: 'left' }}
                    >
                        官方文档
                    </Button>
                )}
                {modelsPage && (
                    <Button
                        icon={<GlobalOutlined />}
                        type="link"
                        href={modelsPage}
                        target="_blank"
                        style={{ textAlign: 'left' }}
                    >
                        模型列表
                    </Button>
                )}
            </div>

            {apiKeyValidated && (
                <Card
                    style={{
                        marginBottom: 16,
                        backgroundColor: '#f6ffed',
                        border: '1px solid #b7eb8f',
                    }}
                    size="small"
                    bordered
                >
                    <Space>
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        <Text>API 连接测试成功</Text>
                    </Space>
                </Card>
            )}
        </Modal>
    );
};

export default ConfigModal;
