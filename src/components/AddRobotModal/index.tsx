import React, { useState, useMemo } from 'react';
import {
    Modal,
    Input,
    Select,
    Row,
    Col,
    Card,
    Typography,
    Tag,
    Pagination,
    message,
    Spin,
} from 'antd';
import { SearchOutlined, LoadingOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import { Robot as RobotType } from '@/types';
import { robotList, getAllGroups } from '@/config/robot';
import { getDefaultTopic } from '@/services/RobotService';
import { getShortRobotName } from '@/utils/robotUtils';
import robotStore from '@/store/robot';

import './index.scss';

const { Text } = Typography;
const antIcon = <LoadingOutlined style={{ fontSize: 24 }} spin />;

interface AddRobotModalProps {
    isVisible: boolean;
    onCancel: () => void;
    loading?: boolean;
}

const AddRobotModal: React.FC<AddRobotModalProps> = ({
    isVisible,
    onCancel,
    loading: externalLoading,
}) => {
    const [searchText, setSearchText] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(12); // 每页显示12个机器人
    const [internalLoading, setInternalLoading] = useState(false);

    // 合并外部和内部的loading状态
    const loading = externalLoading || internalLoading;

    // 获取所有分组
    const allGroups = useMemo(() => getAllGroups(), []);

    // 过滤后的机器人列表
    const filteredRobots = useMemo(() => {
        return robotList.filter((robot) => {
            // 排除已添加的机器人
            const isAlreadyAdded = robotStore.robotList.some(
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
    }, [searchText, selectedGroup, robotStore.robotList]);

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

    const handleAddRobot = async (selectedRobotId: string) => {
        const selectedRobot = robotList.find((robot) => robot.id === selectedRobotId);
        if (!selectedRobot) {
            message.error('未找到选中的机器人');
            return;
        }

        // 检查是否已经添加过
        const existingRobot = robotStore.robotList.find(
            (robot) => robot.name === selectedRobot.name,
        );

        if (existingRobot) {
            message.warning(`机器人 ${selectedRobot.name} 已经存在`);
            return;
        }

        setInternalLoading(true);
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

            await robotStore.addRobot(newRobot);

            message.success(`机器人 ${selectedRobot.name} 添加成功`);
        } catch (error) {
            console.error('Failed to add robot:', error);
            console.error(
                'Stack trace:',
                error instanceof Error ? error.stack : 'No stack trace available',
            );
            message.error(
                `添加机器人失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        } finally {
            setInternalLoading(false);
            onCancel();
        }
    };

    return (
        <Modal
            title="选择机器人"
            open={isVisible}
            onCancel={loading ? undefined : onCancel}
            footer={null}
            width={800}
            className="robot-selection-modal"
            maskClosable={!loading}
            closable={!loading}
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
                                disabled={loading}
                            />
                        </Col>
                        <Col span={12}>
                            <Select
                                placeholder="选择分组"
                                value={selectedGroup}
                                onChange={handleGroupChange}
                                allowClear
                                style={{ width: '100%' }}
                                disabled={loading}
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

                <Spin spinning={loading} indicator={antIcon} tip="处理中...">
                    <div className="robot-grid">
                        {currentPageRobots.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">🤖</div>
                                <div className="empty-title">没有可添加的机器人</div>
                                <div className="empty-description">
                                    {filteredRobots.length === 0 && robotStore.robotList.length > 1
                                        ? '所有机器人都已添加'
                                        : '没有符合条件的机器人'}
                                </div>
                            </div>
                        ) : (
                            <Row gutter={[16, 16]}>
                                {currentPageRobots.map((robot) => (
                                    <Col span={12} key={robot.id}>
                                        <Card
                                            hoverable={!loading}
                                            className="robot-card"
                                            onClick={
                                                loading ? undefined : () => handleAddRobot(robot.id)
                                            }
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
                </Spin>

                <div className="robot-pagination">
                    <Pagination
                        current={currentPage}
                        pageSize={pageSize}
                        total={filteredRobots.length}
                        onChange={setCurrentPage}
                        showSizeChanger={false}
                        showQuickJumper
                        disabled={loading}
                        showTotal={(total, range) =>
                            `第 ${range[0]}-${range[1]} 条，共 ${total} 个机器人`
                        }
                    />
                </div>
            </div>
        </Modal>
    );
};

export default AddRobotModal;
