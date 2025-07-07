import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Switch, message, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { Robot as RobotType } from '@/types';
import robotStore from '@/store/robot';

import './index.scss';

const antIcon = <LoadingOutlined style={{ fontSize: 24 }} spin />;

interface EditRobotModalProps {
    isVisible: boolean;
    onCancel: () => void;
    editingRobot: RobotType | null;
    loading?: boolean;
}

const EditRobotModal: React.FC<EditRobotModalProps> = ({
    isVisible,
    onCancel,
    editingRobot,
    loading: externalLoading,
}) => {
    const [form] = Form.useForm();
    const [internalLoading, setInternalLoading] = useState(false);

    // 合并外部和内部的loading状态
    const loading = externalLoading || internalLoading;

    useEffect(() => {
        if (isVisible && editingRobot) {
            form.setFieldsValue({
                name: editingRobot.name,
                description: editingRobot.description,
                prompt: editingRobot.prompt,
                showPrompt: editingRobot.showPrompt !== false, // Default to true if undefined
            });
        }
    }, [isVisible, editingRobot, form]);

    const handleUpdateRobot = async () => {
        if (!editingRobot) return;

        try {
            const values = await form.validateFields();
            setInternalLoading(true);

            const updatedRobot: RobotType = {
                ...editingRobot,
                name: values.name,
                prompt: values.prompt || '',
                description: values.description || '',
                showPrompt: values.showPrompt,
            };

            await robotStore.updateRobot(updatedRobot);

            message.success(`机器人 ${values.name} 更新成功`);
            onCancel();
        } catch (error) {
            if (error instanceof Error && 'errorFields' in error) {
                // This is a form validation error, don't show message
                console.warn('Validation failed:', error);
            } else {
                console.error('Failed to update robot:', error);
                console.error(
                    'Stack trace:',
                    error instanceof Error ? error.stack : 'No stack trace available',
                );
                message.error(
                    `更新机器人失败: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        } finally {
            setInternalLoading(false);
        }
    };

    return (
        <Modal
            title="编辑机器人"
            open={isVisible}
            onOk={handleUpdateRobot}
            onCancel={loading ? undefined : onCancel}
            confirmLoading={loading}
            maskClosable={!loading}
            closable={!loading}
            okButtonProps={{ disabled: loading }}
            cancelButtonProps={{ disabled: loading }}
            zIndex={10000}
        >
            <Spin spinning={loading} indicator={antIcon} tip="处理中...">
                <Form
                    form={form}
                    layout="vertical"
                    name="edit_robot_form"
                    className="edit-robot-form"
                >
                    <Form.Item
                        name="name"
                        label="机器人名称"
                        rules={[{ required: true, message: '请输入机器人名称' }]}
                    >
                        <Input placeholder="请输入机器人名称" disabled={loading} />
                    </Form.Item>
                    <Form.Item name="description" label="描述">
                        <Input.TextArea placeholder="请输入机器人描述" disabled={loading} />
                    </Form.Item>
                    <Form.Item name="prompt" label="提示词">
                        <Input.TextArea
                            placeholder="请输入提示词，用于指导AI的行为"
                            rows={4}
                            disabled={loading}
                        />
                    </Form.Item>
                    <Form.Item
                        name="showPrompt"
                        valuePropName="checked"
                        label="在聊天界面显示提示词"
                    >
                        <Switch
                            checkedChildren="显示"
                            unCheckedChildren="隐藏"
                            disabled={loading}
                        />
                    </Form.Item>
                </Form>
            </Spin>
        </Modal>
    );
};

export default EditRobotModal;
