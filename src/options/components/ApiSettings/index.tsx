import {
    Avatar,
    Button,
    Form,
    Input,
    List,
    message,
    Modal,
    Select,
    Tag,
    Typography,
    Space,
    Card,
} from 'antd';
import React, { useState } from 'react';
import { GlobalOutlined, KeyOutlined, CodeOutlined, CheckCircleOutlined } from '@ant-design/icons';

import { t } from '@/services/i18n';
import { isLocalhost } from '@/utils';
import { observer } from 'mobx-react';
import { useStore } from '@/store';
import { Provider } from '@/types';
import { getProviderLogo, PROVIDER_CONFIG } from '@/config/providers';
import { checkApiProvider, getModels } from '@/services/apiService';

const { Text } = Typography;

const ApiSettings: React.FC = observer(() => {
    const { llmStore } = useStore();

    const [form] = Form.useForm();
    const [apiKeyValidated, setApiKeyValidated] = useState<boolean>(false);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [currentProvider, setCurrentProvider] = useState<Provider | null>(null);
    const [testing, setTesting] = useState<boolean>(false);

    const validateApiHost = async () => {
        if (!currentProvider) return;

        setTesting(true);

        try {
            const apiKey = form.getFieldValue('apiKey');
            const apiHost = form.getFieldValue('apiHost');

            if (!isLocalhost(currentProvider.id) && !apiKey) {
                message.error(t('pleaseEnterApiKey'));
                setTesting(false);
                return;
            }

            const selectedModel = form.getFieldValue('model');

            const model =
                currentProvider.models.find((m) => m.id === selectedModel) ||
                currentProvider.models[0];

            const { setDefaultModel, updateProvider } = llmStore;

            setDefaultModel(model);
            updateProvider({
                ...currentProvider,
                apiKey,
                apiHost,
            });

            const { valid, error } = await checkApiProvider(
                { ...currentProvider, apiKey, apiHost },
                model,
            );

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

    const openModal = async (provider: Provider) => {
        setCurrentProvider(provider);
        setApiKeyValidated(false);
        const { defaultModel } = llmStore;

        if (provider.models.length === 0 || isLocalhost(provider.id)) {
            const models = await getModels({
                ...provider,
                apiKey: provider.apiKey || 'xxx',
                apiHost: provider.apiHost,
            });

            provider.models = models;
            llmStore.updateProvider({
                ...provider,
                models,
            });
        }
        const model =
            defaultModel?.provider === provider.id
                ? defaultModel?.id
                : provider.models[0]?.id || '';

        // 设置表单数据
        form.setFieldsValue({
            provider: provider.id,
            apiKey: provider.apiKey || '',
            apiHost: provider.apiHost || '',
            model,
        });

        setIsModalOpen(true);
    };

    const onUpdateApiHost = () => {
        const { apiHost } = form.getFieldsValue();
        if (!currentProvider) return;
        llmStore.updateProvider({ ...currentProvider, apiHost });
    };

    const handleOk = async () => {
        try {
            await form.validateFields();

            if (currentProvider) {
                const values = form.getFieldsValue();
                const modelObj = currentProvider.models.find((m) => m.id === values.model);

                // 更新llmStore中的配置
                llmStore.updateProvider({
                    ...currentProvider,
                    apiKey: values.apiKey,
                    apiHost: values.apiHost,
                });

                // 如果找到选择的模型，设置为默认
                if (modelObj && currentProvider.id === llmStore.defaultModel?.provider) {
                    llmStore.setDefaultModel({
                        ...modelObj,
                        provider: currentProvider.id,
                    });
                }

                message.success(`${currentProvider.name} 配置已保存`);
                setIsModalOpen(false);
            }
        } catch (error) {
            console.error('表单验证失败:', error);
        }
    };

    const handleCancel = () => {
        setIsModalOpen(false);
    };

    const setAsDefault = async () => {
        if (!currentProvider) return;

        const values = form.getFieldsValue();

        if (!values.apiKey) {
            message.error('请输入 API 密钥');
            return;
        }

        if (!values.apiHost) {
            message.error('请输入 API 地址');
            return;
        }

        const modelObj = currentProvider.models.find((m) => m.id === values.model);

        if (modelObj) {
            // 设置为默认模型
            llmStore.setDefaultModel({
                ...modelObj,
                provider: currentProvider.id,
            });

            message.success(`已将 ${currentProvider.name} 设为默认提供商`);
        }
    };

    // @ts-ignore
    const providerConfig = (PROVIDER_CONFIG as any)[currentProvider?.id] || {};
    const officialWebsite = providerConfig?.websites?.official;
    const apiKeyWebsite = providerConfig?.websites?.apiKey;
    const modelsPage = providerConfig?.websites?.models;
    const docs = providerConfig?.websites?.docs;

    return (
        <>
            <List
                itemLayout="horizontal"
                dataSource={llmStore.providers}
                renderItem={(item) => (
                    <List.Item key={item.id}>
                        <List.Item.Meta
                            avatar={<Avatar src={getProviderLogo(item.id)} />}
                            title={
                                <a
                                    href={
                                        // @ts-ignore
                                        PROVIDER_CONFIG[item.id]?.websites?.official
                                    }
                                >
                                    {item.name}
                                </a>
                            }
                        />
                        <div>
                            {item.id === llmStore.defaultModel?.provider && (
                                <Tag color="#2db7f5">目前在用</Tag>
                            )}
                            <Button color="cyan" variant="solid" onClick={() => openModal(item)}>
                                设置
                            </Button>
                        </div>
                    </List.Item>
                )}
            />
            <Modal
                title={
                    currentProvider && (
                        <Space>
                            <Avatar size="small" src={getProviderLogo(currentProvider.id)} />
                            {`配置 ${currentProvider.name}`}
                        </Space>
                    )
                }
                open={isModalOpen}
                onOk={handleOk}
                onCancel={handleCancel}
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
                        key="default"
                        type="default"
                        onClick={setAsDefault}
                        disabled={currentProvider?.id === llmStore.defaultModel?.provider}
                    >
                        设为默认
                    </Button>,
                    <Button key="cancel" onClick={handleCancel}>
                        取消
                    </Button>,
                    <Button key="save" type="primary" onClick={handleOk}>
                        保存
                    </Button>,
                ]}
            >
                <Form form={form} layout="vertical" requiredMark={false}>
                    {!currentProvider || !isLocalhost(currentProvider.id) ? (
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
                                rules={[{ required: true, message: '请输入 API 密钥' }]}
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
                            options={currentProvider?.models.map((model) => ({
                                label: model.name,
                                value: model.id,
                            }))}
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
        </>
    );
});

export default ApiSettings;
