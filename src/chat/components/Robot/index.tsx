import React, { useState, useMemo } from 'react';
import { List, Button, Modal, Input, message } from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SearchOutlined,
    CheckOutlined,
    RobotOutlined,
} from '@ant-design/icons';
import { observer } from 'mobx-react-lite';
import { Robot as RobotType } from '@/types';
import { getShortRobotName, getShortRobotDescription } from '@/utils/robotUtils';
import robotStore from '@/store/robot';
import AddRobotModal from '@/components/AddRobotModal';
import EditRobotModal from './components/EditRobotModal';

import './index.scss';

interface RobotProps {
    onSwitchToTopics?: () => void;
}

const Robot: React.FC<RobotProps> = observer(({ onSwitchToTopics }) => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingRobot, setEditingRobot] = useState<RobotType | null>(null);
    const [robotSearchText, setRobotSearchText] = useState('');
    const [loading, setLoading] = useState(false);

    const showModal = () => {
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        if (loading) return; // 如果正在加载，不允许关闭
        setIsModalVisible(false);
    };

    const handleEditRobot = (robot: RobotType) => {
        setEditingRobot(robot);
        setIsEditModalVisible(true);
    };

    const handleEditCancel = () => {
        if (loading) return; // 如果正在加载，不允许关闭
        setIsEditModalVisible(false);
        setEditingRobot(null);
    };

    const handleDeleteRobot = (robot: RobotType) => {
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除机器人 "${robot.name}" 吗？`,
            okText: '确定',
            cancelText: '取消',
            okButtonProps: { loading },
            cancelButtonProps: { disabled: loading },
            zIndex: 10000,
            onOk: async () => {
                if (robotStore.robotList.length <= 1) {
                    message.error('至少保留一个机器人');
                    return;
                }

                setLoading(true);
                try {
                    const result = await robotStore.removeRobot(robot.id);
                    if (!result.success) {
                        message.error(result.message || `机器人 ${robot.name} 无法删除`);
                        return;
                    }
                    message.success(result.message || `机器人 ${robot.name} 删除成功`);
                } catch (error) {
                    console.error('Failed to remove robot:', error);
                    console.error(
                        'Stack trace:',
                        error instanceof Error ? error.stack : 'No stack trace available',
                    );
                    message.error(
                        `删除机器人失败: ${error instanceof Error ? error.message : String(error)}`,
                    );
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const handleSelectRobot = async (robot: RobotType) => {
        setLoading(true);
        try {
            await robotStore.updateSelectedRobot(robot);

            message.success(`已选中机器人 ${robot.name}`);

            // 延时一下，体验好一些
            setTimeout(() => {
                if (onSwitchToTopics) {
                    onSwitchToTopics();
                }
            }, 200);
        } catch (error) {
            console.error('Failed to select robot:', error);
            console.error(
                'Stack trace:',
                error instanceof Error ? error.stack : 'No stack trace available',
            );
            message.error(
                `选择机器人失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        } finally {
            setLoading(false);
        }
    };

    // 过滤后的机器人列表（已添加的机器人）
    const filteredRobotList = useMemo(() => {
        return robotStore.robotList.filter((robot) => {
            const matchesSearch =
                !robotSearchText ||
                robot.name.toLowerCase().includes(robotSearchText.toLowerCase()) ||
                (robot.description &&
                    robot.description.toLowerCase().includes(robotSearchText.toLowerCase()));

            return matchesSearch;
        });
    }, [robotSearchText, robotStore.robotList]);

    const isSelected = useMemo(
        () => (id: string) => {
            return robotStore.selectedRobot?.id === id;
        },
        [robotStore.selectedRobot],
    );

    return (
        <div className="robot-container">
            <div className="robot-header">
                <h3>
                    <RobotOutlined /> 机器人列表
                </h3>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={showModal}
                    disabled={loading}
                >
                    添加机器人
                </Button>
            </div>

            <div className="robot-search-container">
                <Input
                    placeholder="搜索机器人名称或描述..."
                    prefix={<SearchOutlined />}
                    value={robotSearchText}
                    onChange={(e) => setRobotSearchText(e.target.value)}
                    allowClear
                    className="robot-search-input"
                    disabled={loading}
                />
            </div>

            <div className="robot-list-container">
                <List
                    loading={loading}
                    itemLayout="horizontal"
                    dataSource={filteredRobotList}
                    renderItem={(robot) => {
                        return (
                            <List.Item
                                className={`robot-list-item ${
                                    isSelected(robot.id) ? 'selected' : ''
                                }`}
                            >
                                <div className="robot-content">
                                    <div className="robot-avatar">{robot.icon || '🤖'}</div>
                                    <div className="robot-info">
                                        <div className="robot-name">
                                            {getShortRobotName(robot.name)}
                                            {isSelected(robot.id) && (
                                                <span className="selected-badge">
                                                    <CheckOutlined /> 已选中
                                                </span>
                                            )}
                                        </div>
                                        {robot.description && (
                                            <div className="robot-description">
                                                {getShortRobotDescription(robot.description, 20)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="action-buttons">
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<CheckOutlined />}
                                            className={`action-button select-button ${
                                                isSelected(robot.id) ? 'selected' : ''
                                            }`}
                                            onClick={() => handleSelectRobot(robot)}
                                            disabled={isSelected(robot.id) || loading}
                                        >
                                            {isSelected(robot.id) ? '已选中' : '选中'}
                                        </Button>
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<EditOutlined />}
                                            className="action-button edit-button"
                                            onClick={() => handleEditRobot(robot)}
                                            disabled={loading}
                                        >
                                            编辑
                                        </Button>
                                        <Button
                                            type="text"
                                            size="small"
                                            danger
                                            icon={<DeleteOutlined />}
                                            className="action-button delete-button"
                                            onClick={() => handleDeleteRobot(robot)}
                                            disabled={loading}
                                        >
                                            删除
                                        </Button>
                                    </div>
                                </div>
                            </List.Item>
                        );
                    }}
                />
            </div>

            {/* 使用重构后的模态框组件 */}
            <AddRobotModal isVisible={isModalVisible} onCancel={handleCancel} loading={loading} />

            <EditRobotModal
                isVisible={isEditModalVisible}
                onCancel={handleEditCancel}
                editingRobot={editingRobot}
                loading={loading}
            />
        </div>
    );
});

export default Robot;
