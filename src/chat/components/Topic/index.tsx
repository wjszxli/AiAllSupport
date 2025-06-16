import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    List,
    Button,
    Input,
    Modal,
    message as messageApi,
    Empty,
    Typography,
    Space,
    Tooltip,
    Alert,
} from 'antd';

import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    MessageOutlined,
    ClockCircleOutlined,
    RobotOutlined,
    SearchOutlined,
} from '@ant-design/icons';

import { Topic as TopicType } from '@/types';
import { t } from '@/locales/i18n';
import { useStore } from '@/store';
import { getShortRobotName } from '@/utils/robotUtils';
import './index.scss';

// const { Search } = Input; // 不再使用Search组件，改用普通Input保持一致性
const { Text } = Typography;

interface TopicProps {}

const Topic: React.FC<TopicProps> = observer(() => {
    const { robotStore } = useStore();
    const [searchText, setSearchText] = useState('');
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [newTopicName, setNewTopicName] = useState('');
    const [editingTopic, setEditingTopic] = useState<TopicType | null>(null);

    // 直接从robotStore获取话题数据并进行过滤
    const topics = robotStore.selectedRobot?.topics || [];
    const filteredTopics = topics.filter((topic) =>
        topic.name.toLowerCase().includes(searchText.toLowerCase()),
    );

    const handleCreateTopic = async () => {
        if (!newTopicName.trim()) {
            messageApi.error(t('topicNameRequired') || '请输入话题名称');
            return;
        }

        if (!robotStore.selectedRobot) {
            messageApi.error('请先选择一个机器人');
            return;
        }

        // 检查是否有重复的话题名称
        const existingTopic = robotStore.selectedRobot.topics.find(
            (topic) => topic.name.toLowerCase() === newTopicName.trim().toLowerCase(),
        );

        if (existingTopic) {
            messageApi.error(`话题名称 "${newTopicName.trim()}" 已存在，请使用其他名称`);
            return;
        }

        const newTopic = {
            id: `topic-${Date.now()}`,
            assistantId: robotStore.selectedRobot.id,
            name: newTopicName.trim(),
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isNameManuallyEdited: true,
        };

        try {
            await robotStore.addTopic(robotStore.selectedRobot.id, newTopic);
            messageApi.success(`话题 "${newTopicName.trim()}" 创建成功`);
            setNewTopicName('');
            setIsCreateModalVisible(false);
        } catch (error) {
            messageApi.error(
                `创建话题失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    };

    const handleEditTopic = async () => {
        if (!editingTopic || !newTopicName.trim()) {
            messageApi.error(t('topicNameRequired') || '请输入话题名称');
            return;
        }

        if (!robotStore.selectedRobot) {
            messageApi.error('请先选择一个机器人');
            return;
        }

        // 检查是否有重复的话题名称（排除当前编辑的话题）
        const existingTopic = robotStore.selectedRobot.topics.find(
            (t) =>
                t.id !== editingTopic.id &&
                t.name.toLowerCase() === newTopicName.trim().toLowerCase(),
        );

        if (existingTopic) {
            messageApi.error(`话题名称 "${newTopicName.trim()}" 已存在，请使用其他名称`);
            return;
        }

        const updatedTopic = { ...editingTopic, name: newTopicName.trim() };
        try {
            await robotStore.updateTopic(robotStore.selectedRobot.id, updatedTopic);
            messageApi.success(`话题 "${newTopicName.trim()}" 更新成功`);
            setNewTopicName('');
            setEditingTopic(null);
            setIsEditModalVisible(false);
        } catch (error) {
            messageApi.error(
                `更新话题失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    };

    const handleDeleteTopic = (topic: TopicType) => {
        Modal.confirm({
            title: t('deleteTopicConfirm') || '确认删除话题',
            content: `${t('deleteTopicContent') || '确定要删除话题'} "${topic.name}" ${
                t('question') || '吗？'
            }`,
            okText: t('delete') || '删除',
            okType: 'danger',
            cancelText: t('cancel') || '取消',
            onOk: async () => {
                if (!robotStore.selectedRobot) {
                    messageApi.error('请先选择一个机器人');
                    return;
                }

                try {
                    await robotStore.removeTopic(robotStore.selectedRobot.id, topic);
                    messageApi.success(`话题 "${topic.name}" 删除成功`);
                } catch (error) {
                    messageApi.error(
                        `删除话题失败: ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            },
        });
    };

    const openEditModal = (topic: TopicType) => {
        setEditingTopic(topic);
        setNewTopicName(topic.name);
        setIsEditModalVisible(true);
    };

    const handleTopicSelect = async (topic: TopicType) => {
        try {
            await robotStore.updateSelectedTopic(topic.id);
            console.log('Selected topic:', topic.name);
            // TODO: 实现话题选择后的具体逻辑，比如加载话题消息等
        } catch (error) {
            messageApi.error(
                `选择话题失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffInHours < 24 * 7) {
            return date.toLocaleDateString([], {
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
            });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    return (
        <div className="topic-container">
            <div className="topic-header">
                <div className="topic-title">
                    <MessageOutlined /> {t('topics') || '话题'}
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsCreateModalVisible(true)}
                    size="small"
                    disabled={!robotStore.selectedRobot}
                >
                    {t('newTopic') || '新建话题'}
                </Button>
            </div>

            {/* 显示当前选中的机器人 */}
            {robotStore.selectedRobot ? (
                <Alert
                    message={
                        <Space>
                            <RobotOutlined />
                            <span>
                                当前机器人: {getShortRobotName(robotStore.selectedRobot.name)}
                            </span>
                            <span className="robot-emoji">
                                {robotStore.selectedRobot.icon || '🤖'}
                            </span>
                        </Space>
                    }
                    type="info"
                    showIcon={false}
                    className="selected-robot-info"
                />
            ) : (
                <Alert
                    message="请先在机器人页面选择一个机器人"
                    type="warning"
                    showIcon
                    className="no-robot-warning"
                />
            )}

            <div className="topic-search">
                <Input
                    placeholder={t('searchTopics') || '搜索话题...'}
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    allowClear
                    className="topic-search-input"
                />
            </div>

            <div className="topic-list">
                {filteredTopics.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            searchText
                                ? t('noTopicsFound') || '未找到相关话题'
                                : t('noTopics') || '暂无话题'
                        }
                    />
                ) : (
                    <List
                        dataSource={filteredTopics}
                        renderItem={(topic) => (
                            <List.Item
                                className={`topic-item ${
                                    robotStore.selectedRobot?.selectedTopicId === topic.id
                                        ? 'selected'
                                        : ''
                                }`}
                                onClick={() => handleTopicSelect(topic)}
                                actions={[
                                    <Tooltip title={t('edit') || '编辑'} key="edit">
                                        <Button
                                            type="text"
                                            icon={<EditOutlined />}
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEditModal(topic);
                                            }}
                                        />
                                    </Tooltip>,
                                    <Tooltip title={t('delete') || '删除'} key="delete">
                                        <Button
                                            type="text"
                                            icon={<DeleteOutlined />}
                                            size="small"
                                            danger
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTopic(topic);
                                            }}
                                        />
                                    </Tooltip>,
                                ]}
                            >
                                <List.Item.Meta
                                    title={
                                        <div className="topic-name">
                                            {topic.name}
                                            {topic.messages.length > 0 && (
                                                <span className="message-count">
                                                    {topic.messages.length}
                                                </span>
                                            )}
                                        </div>
                                    }
                                    description={
                                        <Space size="small" className="topic-meta">
                                            <ClockCircleOutlined />
                                            <Text type="secondary" className="topic-time">
                                                {formatDate(topic.updatedAt)}
                                            </Text>
                                        </Space>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                )}
            </div>

            {/* 创建话题模态框 */}
            <Modal
                title={t('createTopic') || '创建话题'}
                open={isCreateModalVisible}
                onOk={handleCreateTopic}
                onCancel={() => {
                    setIsCreateModalVisible(false);
                    setNewTopicName('');
                }}
                okText={t('create') || '创建'}
                cancelText={t('cancel') || '取消'}
            >
                <Input
                    placeholder={t('enterTopicName') || '请输入话题名称'}
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    onPressEnter={handleCreateTopic}
                    maxLength={50}
                />
            </Modal>

            {/* 编辑话题模态框 */}
            <Modal
                title={t('editTopic') || '编辑话题'}
                open={isEditModalVisible}
                onOk={handleEditTopic}
                onCancel={() => {
                    setIsEditModalVisible(false);
                    setNewTopicName('');
                    setEditingTopic(null);
                }}
                okText={t('save') || '保存'}
                cancelText={t('cancel') || '取消'}
            >
                <Input
                    placeholder={t('enterTopicName') || '请输入话题名称'}
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    onPressEnter={handleEditTopic}
                    maxLength={50}
                />
            </Modal>
        </div>
    );
});

export default Topic;
