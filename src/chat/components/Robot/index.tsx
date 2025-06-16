import React, { useState, useMemo, useEffect } from 'react';
import {
    List,
    Button,
    Modal,
    Form,
    Input,
    message,
    Select,
    Card,
    Row,
    Col,
    Typography,
    Tag,
    Pagination,
    Switch,
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SearchOutlined,
    CheckOutlined,
    RobotOutlined,
} from '@ant-design/icons';
import { observer } from 'mobx-react-lite';
import { v4 as uuidv4 } from 'uuid';
import { Robot as RobotType } from '@/types';
import { getDefaultTopic } from '@/services/RobotService';
import { robotList, getAllGroups } from '@/config/robot';
import { getShortRobotName, getShortRobotDescription } from '@/utils/robotUtils';
import robotDB from '@/db/robotDB';
import robotStore from '@/store/robot';

import './index.scss';

const { Text } = Typography;

interface RobotProps {
    onSwitchToTopics?: () => void;
}

const Robot: React.FC<RobotProps> = ({ onSwitchToTopics }) => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingRobot, setEditingRobot] = useState<RobotType | null>(null);
    const [searchText, setSearchText] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const [robotSearchText, setRobotSearchText] = useState('');
    const [pageSize] = useState(12); // 每页显示12个机器人
    const [form] = Form.useForm();
    const [editForm] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [robotListState, setRobotListState] = useState<RobotType[]>([]);

    const loadRobots = async () => {
        setLoading(true);
        try {
            await robotDB.updateRobotList();
            setRobotListState(robotDB.robotList);
        } catch (error) {
            console.error('Failed to load robots:', error);
            message.error('加载机器人失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRobots();

        // 注册编辑机器人的处理函数到robotStore
        robotStore.setEditRobotHandler(handleEditRobot);

        // 清理函数
        return () => {
            robotStore.setEditRobotHandler(null);
        };
    }, []);

    const showModal = () => {
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

    const handleAddRobot = async (selectedRobotId: string) => {
        const selectedRobot = robotList.find((robot) => robot.id === selectedRobotId);
        if (!selectedRobot) {
            message.error('未找到选中的机器人');
            return;
        }

        // 检查是否已经添加过
        const existingRobot = robotListState.find((robot) => robot.name === selectedRobot.name);
        if (existingRobot) {
            message.warning(`机器人 ${selectedRobot.name} 已经存在`);
            return;
        }

        setLoading(true);
        try {
            const defaultTopic = getDefaultTopic(uuidv4());
            const newRobot: RobotType = {
                id: uuidv4(),
                name: selectedRobot.name,
                prompt: selectedRobot.prompt,
                description: selectedRobot.description,
                icon: selectedRobot.icon,
                type: 'assistant',
                topics: [defaultTopic],
                selectedTopicId: defaultTopic.id,
            };

            await robotDB.addRobot(newRobot);
            setRobotListState(robotDB.robotList);
            message.success(`机器人 ${selectedRobot.name} 添加成功`);
        } catch (error) {
            console.error('Failed to add robot:', error);
            message.error(
                `添加机器人失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        } finally {
            setLoading(false);
            setIsModalVisible(false);
            loadRobots();
        }
    };

    const handleEditRobot = (robot: RobotType) => {
        setEditingRobot(robot);
        editForm.setFieldsValue({
            name: robot.name,
            description: robot.description,
            prompt: robot.prompt,
            showPrompt: robot.showPrompt !== false, // Default to true if undefined
        });
        setIsEditModalVisible(true);
        loadRobots();
    };

    const handleEditCancel = () => {
        setIsEditModalVisible(false);
        setEditingRobot(null);
        editForm.resetFields();
    };

    const handleUpdateRobot = async () => {
        if (!editingRobot) return;

        try {
            const values = await editForm.validateFields();
            setLoading(true);

            const updatedRobot: RobotType = {
                ...editingRobot,
                name: values.name,
                prompt: values.prompt || '',
                description: values.description || '',
                showPrompt: values.showPrompt,
            };

            await robotDB.updateRobot(updatedRobot);
            setRobotListState(robotDB.robotList);
            message.success(`机器人 ${values.name} 更新成功`);
            setIsEditModalVisible(false);
            setEditingRobot(null);
            editForm.resetFields();
        } catch (error) {
            if (error instanceof Error && 'errorFields' in error) {
                // This is a form validation error, don't show message
                console.warn('Validation failed:', error);
            } else {
                console.error('Failed to update robot:', error);
                message.error(
                    `更新机器人失败: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        } finally {
            setLoading(false);
            loadRobots();
        }
    };

    const handleDeleteRobot = (robot: RobotType) => {
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除机器人 "${robot.name}" 吗？`,
            okText: '确定',
            cancelText: '取消',
            onOk: async () => {
                if (robotListState.length === 1) {
                    message.error('至少保留一个机器人');
                    return;
                }

                setLoading(true);
                try {
                    await robotDB.removeRobot(robot.id);
                    setRobotListState(robotDB.robotList);
                    message.success(`机器人 ${robot.name} 删除成功`);
                } catch (error) {
                    console.error('Failed to remove robot:', error);
                    message.error(
                        `删除机器人失败: ${error instanceof Error ? error.message : String(error)}`,
                    );
                } finally {
                    setLoading(false);
                    loadRobots();
                }
            },
        });
    };

    const handleSelectRobot = async (robot: RobotType) => {
        setLoading(true);
        try {
            await robotDB.updateSelectedRobot(robot);
            message.success(`已选中机器人 ${robot.name}`);

            // 跳转到话题tab
            if (onSwitchToTopics) {
                onSwitchToTopics();
            }
        } catch (error) {
            console.error('Failed to select robot:', error);
            message.error(
                `选择机器人失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        } finally {
            setLoading(false);
        }
    };

    // 获取所有分组
    const allGroups = useMemo(() => getAllGroups(), []);

    // 过滤后的机器人列表（已添加的机器人）
    const filteredRobotList = useMemo(() => {
        return robotListState.filter((robot) => {
            const matchesSearch =
                !robotSearchText ||
                robot.name.toLowerCase().includes(robotSearchText.toLowerCase()) ||
                (robot.description &&
                    robot.description.toLowerCase().includes(robotSearchText.toLowerCase()));

            return matchesSearch;
        });
    }, [robotSearchText, robotListState]);

    // 过滤后的机器人列表
    const filteredRobots = useMemo(() => {
        return robotList.filter((robot) => {
            // 排除已添加的机器人
            const isAlreadyAdded = robotListState.some(
                (addedRobot) => addedRobot.name === robot.name,
            );
            if (isAlreadyAdded) return false;

            const matchesSearch =
                !searchText ||
                robot.name.toLowerCase().includes(searchText.toLowerCase()) ||
                robot.description.toLowerCase().includes(searchText.toLowerCase());

            const matchesGroup = !selectedGroup || robot.group.includes(selectedGroup);

            return matchesSearch && matchesGroup;
        });
    }, [searchText, selectedGroup, robotListState]);

    // 当前页的机器人列表
    const currentPageRobots = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return filteredRobots.slice(startIndex, endIndex);
    }, [filteredRobots, currentPage, pageSize]);

    // 重置分页当搜索条件改变时
    const handleSearchChange = (value: string) => {
        setSearchText(value);
        setCurrentPage(1);
    };

    const handleGroupChange = (value: string) => {
        setSelectedGroup(value);
        setCurrentPage(1);
    };

    return (
        <div className="robot-container">
            <div className="robot-header">
                <h3>
                    <RobotOutlined /> 机器人列表
                </h3>
                <Button type="primary" icon={<PlusOutlined />} onClick={showModal}>
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
                />
            </div>

            <div className="robot-list-container">
                <List
                    loading={loading}
                    itemLayout="horizontal"
                    dataSource={filteredRobotList}
                    renderItem={(robot) => {
                        const isSelected = robotDB.selectedRobot?.id === robot.id;
                        return (
                            <List.Item
                                className={`robot-list-item ${isSelected ? 'selected' : ''}`}
                            >
                                <div className="robot-content">
                                    <div className="robot-avatar">{robot.icon || '🤖'}</div>
                                    <div className="robot-info">
                                        <div className="robot-name">
                                            {getShortRobotName(robot.name)}
                                            {isSelected && (
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
                                                isSelected ? 'selected' : ''
                                            }`}
                                            onClick={() => handleSelectRobot(robot)}
                                            disabled={isSelected}
                                        >
                                            {isSelected ? '已选中' : '选中'}
                                        </Button>
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<EditOutlined />}
                                            className="action-button edit-button"
                                            onClick={() => handleEditRobot(robot)}
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

            <Modal
                title="选择机器人"
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
                width={800}
                className="robot-selection-modal"
            >
                <div className="robot-selection-content">
                    <div className="search-filters">
                        <Row gutter={16}>
                            <Col span={12}>
                                <Input
                                    placeholder="搜索机器人名称或描述..."
                                    prefix={<SearchOutlined />}
                                    value={searchText}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                />
                            </Col>
                            <Col span={12}>
                                <Select
                                    placeholder="选择分组"
                                    value={selectedGroup}
                                    onChange={handleGroupChange}
                                    allowClear
                                    style={{ width: '100%' }}
                                >
                                    {allGroups.map((group) => (
                                        <Select.Option key={group} value={group}>
                                            {group}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Col>
                        </Row>
                    </div>

                    <div className="robot-grid">
                        {currentPageRobots.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">🤖</div>
                                <div className="empty-title">没有可添加的机器人</div>
                                <div className="empty-description">
                                    {filteredRobots.length === 0 && robotListState.length > 1
                                        ? '所有机器人都已添加'
                                        : '没有符合条件的机器人'}
                                </div>
                            </div>
                        ) : (
                            <Row gutter={[16, 16]}>
                                {currentPageRobots.map((robot) => (
                                    <Col span={12} key={robot.id}>
                                        <Card
                                            hoverable
                                            className="robot-card"
                                            onClick={() => handleAddRobot(robot.id)}
                                        >
                                            <div className="robot-card-content">
                                                <div className="robot-card-header">
                                                    <span className="robot-icon">{robot.icon}</span>
                                                    <Text strong className="robot-title">
                                                        {getShortRobotName(robot.name)}
                                                    </Text>
                                                </div>
                                                <div className="robot-groups">
                                                    {robot.group.slice(0, 3).map((group) => (
                                                        <Tag key={group}>{group}</Tag>
                                                    ))}
                                                    {robot.group.length > 3 && (
                                                        <Tag>+{robot.group.length - 3}</Tag>
                                                    )}
                                                </div>
                                                <Text className="robot-desc">
                                                    {robot.description.length > 60
                                                        ? `${robot.description.slice(0, 60)}...`
                                                        : robot.description}
                                                </Text>
                                            </div>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        )}
                    </div>

                    <div className="robot-pagination">
                        <Pagination
                            current={currentPage}
                            pageSize={pageSize}
                            total={filteredRobots.length}
                            onChange={setCurrentPage}
                            showSizeChanger={false}
                            showQuickJumper
                            showTotal={(total, range) =>
                                `第 ${range[0]}-${range[1]} 条，共 ${total} 个机器人`
                            }
                        />
                    </div>
                </div>
            </Modal>

            <Modal
                title="编辑机器人"
                open={isEditModalVisible}
                onOk={handleUpdateRobot}
                onCancel={handleEditCancel}
                confirmLoading={loading}
            >
                <Form form={editForm} layout="vertical" name="edit_robot_form">
                    <Form.Item
                        name="name"
                        label="机器人名称"
                        rules={[{ required: true, message: '请输入机器人名称' }]}
                    >
                        <Input placeholder="请输入机器人名称" />
                    </Form.Item>
                    <Form.Item name="description" label="描述">
                        <Input.TextArea placeholder="请输入机器人描述" />
                    </Form.Item>
                    <Form.Item name="prompt" label="提示词">
                        <Input.TextArea placeholder="请输入提示词，用于指导AI的行为" rows={4} />
                    </Form.Item>
                    <Form.Item
                        name="showPrompt"
                        valuePropName="checked"
                        label="在聊天界面显示提示词"
                    >
                        <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default observer(Robot);
