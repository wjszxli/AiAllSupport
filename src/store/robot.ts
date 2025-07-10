import type { Robot, Topic } from '@/types';
import { db } from '../db/index';
import { makeAutoObservable } from 'mobx';
import { isEmpty, uniqBy } from 'lodash';
import { getDefaultRobot } from '@/services/RobotService';

const SELECTED_ROBOT_KEY = 'selectedRobotId';
const SELECTED_TOPIC_KEY = 'selectedTopicId';

export class RobotDB {
    private logger: any = {
        info: (msg: string, ...args: any[]) => console.log(`[RobotDB] ${msg}`, ...args),
        error: (msg: string, ...args: any[]) => console.error(`[RobotDB] ${msg}`, ...args),
        warn: (msg: string, ...args: any[]) => console.warn(`[RobotDB] ${msg}`, ...args),
        debug: (msg: string, ...args: any[]) => console.debug(`[RobotDB] ${msg}`, ...args),
    };
    robotList: Robot[] = [];
    selectedRobot: Robot = {} as Robot;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });

        // 异步初始化真正的Logger
        this.initLogger();
        this.initializeFromDB();
    }

    private async initLogger() {
        try {
            const { Logger } = await import('@/utils/logger');
            this.logger = new Logger('RobotDB');
        } catch (error) {
            console.error('Failed to initialize logger in RobotDB:', error);
        }
    }

    async initializeFromDB() {
        try {
            const robots = await db.table('robots').toArray();
            this.robotList = robots;

            const defaultRobot = getDefaultRobot();

            if (robots.length === 0) {
                await this.saveRobotToDB(defaultRobot);
                this.robotList = [defaultRobot];
                this.selectedRobot = defaultRobot;

                await this.saveSettingToStorage(SELECTED_ROBOT_KEY, defaultRobot.id);
                if (defaultRobot.selectedTopicId) {
                    await this.saveSettingToStorage(
                        SELECTED_TOPIC_KEY,
                        defaultRobot.selectedTopicId,
                    );
                }
                return;
            }

            // Try to load the selected robot ID from settings
            const selectedRobotId = await this.getSettingFromStorage(SELECTED_ROBOT_KEY);

            if (selectedRobotId) {
                // Find the robot with the stored ID
                const selectedRobot = robots.find((robot) => robot.id === selectedRobotId);
                if (selectedRobot) {
                    this.selectedRobot = selectedRobot;

                    // Try to load the selected topic ID
                    const selectedTopicId = await this.getSettingFromStorage(SELECTED_TOPIC_KEY);
                    if (selectedTopicId && selectedRobot.topics) {
                        // Check if the topic exists in the robot
                        const topicExists = selectedRobot.topics.some(
                            (topic: Topic) => topic.id === selectedTopicId,
                        );
                        if (topicExists) {
                            this.selectedRobot.selectedTopicId = selectedTopicId;
                        }
                    }

                    return;
                }
            }

            // If no selected robot ID or robot not found, use the first robot or default
            if (robots.length > 0) {
                this.selectedRobot = robots[0];
                await this.saveSettingToStorage(SELECTED_ROBOT_KEY, robots[0].id);
                if (robots[0].selectedTopicId) {
                    await this.saveSettingToStorage(SELECTED_TOPIC_KEY, robots[0].selectedTopicId);
                }
            } else {
                this.selectedRobot = defaultRobot;
                await this.saveSettingToStorage(SELECTED_ROBOT_KEY, defaultRobot.id);
                if (defaultRobot.selectedTopicId) {
                    await this.saveSettingToStorage(
                        SELECTED_TOPIC_KEY,
                        defaultRobot.selectedTopicId,
                    );
                }
            }
        } catch (error) {
            this.logger.error('Failed to initialize robots from DB:', error);
        }
    }

    async saveSettingToStorage(key: string, value: any) {
        try {
            await new Promise<void>((resolve) => {
                chrome.storage.local.set({ [`robot.${key}`]: value }, () => resolve());
            });
        } catch (error) {
            this.logger.error(`Failed to save setting ${key}:`, error);
        }
    }

    async getSettingFromStorage(key: string): Promise<any> {
        try {
            return new Promise((resolve) => {
                chrome.storage.local.get([`robot.${key}`], (result) => {
                    resolve(result[`robot.${key}`] || null);
                });
            });
        } catch (error) {
            this.logger.error(`Failed to get setting ${key}:`, error);
            return null;
        }
    }

    async saveRobotToDB(robot: Robot) {
        try {
            this.logger.info('saveRobotToDB', robot);
            await db.table('robots').put(JSON.parse(JSON.stringify(robot)));
            return robot;
        } catch (error) {
            this.logger.error('Failed to save robot to DB:', error);
            throw error;
        }
    }

    async getRobotFromDB(robotId: string) {
        try {
            return await db.table('robots').get(robotId);
        } catch (error) {
            this.logger.error('Failed to get robot from DB:', error);
            throw error;
        }
    }

    async deleteRobotFromDB(robotId: string) {
        try {
            await db.table('robots').delete(robotId);
        } catch (error) {
            this.logger.error('Failed to delete robot from DB:', error);
            throw error;
        }
    }

    async getAllRobotsFromDB() {
        try {
            return await db.table('robots').toArray();
        } catch (error) {
            this.logger.error('Failed to get all robots from DB:', error);
            throw error;
        }
    }

    async updateSelectedRobot(robot: Robot) {
        try {
            this.logger.info('updateSelectedRobot', robot);
            if (!robot.selectedTopicId && robot.topics && robot.topics.length > 0) {
                robot.selectedTopicId = robot.topics[0].id;
            }

            this.selectedRobot = robot;

            await this.saveSettingToStorage(SELECTED_ROBOT_KEY, robot.id);

            if (robot.selectedTopicId) {
                await this.saveSettingToStorage(SELECTED_TOPIC_KEY, robot.selectedTopicId);
            }

            await this.updateRobot(robot);
        } catch (error) {
            this.logger.error('Failed to update selected robot:', error);
            throw error;
        }
    }

    async getSelectedRobotFromDB() {
        try {
            return await db.table('robots').get(this.selectedRobot.id);
        } catch (error) {
            this.logger.error('Failed to get selected robot from DB:', error);
            throw error;
        }
    }

    async updateSelectedTopic(topicId: string) {
        try {
            if (!this.selectedRobot) {
                throw new Error('No robot selected');
            }

            this.selectedRobot = {
                ...this.selectedRobot,
                selectedTopicId: topicId,
            };

            await this.saveSettingToStorage(SELECTED_TOPIC_KEY, topicId);

            await this.updateRobot(this.selectedRobot);
        } catch (error) {
            this.logger.error('Failed to update selected topic:', error);
            throw error;
        }
    }

    async updateRobotList() {
        try {
            const robots = await this.getAllRobotsFromDB();

            const selectedRobotId = this.selectedRobot?.id;

            this.robotList = robots;

            if (selectedRobotId) {
                const selectedRobot = robots.find((robot) => robot.id === selectedRobotId);
                if (selectedRobot) {
                    this.selectedRobot = selectedRobot;
                }
            }
        } catch (error) {
            this.logger.error('Failed to update robot list:', error);
        }
    }

    async addRobot(robot: Robot) {
        try {
            await this.saveRobotToDB(robot);
            await this.updateRobotList();
        } catch (error) {
            this.logger.error('Failed to add robot:', error);
            throw error;
        }
    }

    async removeRobot(id: string): Promise<{ success: boolean; message: string }> {
        try {
            // 获取机器人信息
            const robot = await this.getRobotFromDB(id);

            const isSelected = this.selectedRobot?.id === id;
            if (isSelected) {
                this.logger.warn('Cannot delete currently selected robot:', id);
                return {
                    success: false,
                    message: '无法删除当前选中的机器人，请先选择其他机器人',
                };
            }

            // 检查是否为不可删除的机器人
            if (robot && robot.cannotDelete) {
                this.logger.warn('Cannot delete robot marked as cannotDelete:', id);
                return {
                    success: false,
                    message: '该机器人不允许删除',
                };
            }

            // Delete from DB
            await this.deleteRobotFromDB(id);
            // Update local list
            await this.updateRobotList();
            return {
                success: true,
                message: '机器人删除成功',
            };
        } catch (error) {
            this.logger.error('Failed to remove robot:', error);
            return {
                success: false,
                message: `删除机器人失败: ${error instanceof Error ? error.message : '未知错误'}`,
            };
        }
    }

    async updateRobot(updatedRobot: Robot) {
        try {
            await this.saveRobotToDB(updatedRobot);

            const index = this.robotList.findIndex((r) => r.id === updatedRobot.id);
            if (index !== -1) {
                this.robotList[index] = updatedRobot;
            }

            if (this.selectedRobot.id === updatedRobot.id) {
                this.selectedRobot = updatedRobot;
            }
        } catch (error) {
            this.logger.error('Failed to update robot:', error);
            throw error;
        }
    }

    async addTopic(robotId: string, topic: Topic) {
        try {
            topic.createdAt = topic.createdAt || new Date().toISOString();
            topic.updatedAt = topic.updatedAt || new Date().toISOString();

            const robot = await this.getRobotFromDB(robotId);
            if (!robot) {
                throw new Error(`Robot with id ${robotId} not found`);
            }

            robot.topics = uniqBy([topic, ...robot.topics], 'id');

            if (this.selectedRobot && this.selectedRobot.id === robotId) {
                this.selectedRobot = {
                    ...this.selectedRobot,
                    topics: uniqBy([topic, ...this.selectedRobot.topics], 'id'),
                    selectedTopicId: topic.id, // Auto-select new topic
                };
            }

            await this.saveRobotToDB(robot);
            await this.updateRobotList();

            // 检查话题是否已存在，避免主键冲突
            const existingTopic = await db.topics.get(topic.id);
            if (!existingTopic) {
                await db.topics.add({
                    id: topic.id,
                    messages: [],
                });
            }
        } catch (error) {
            this.logger.error('Failed to add topic:', error);
            throw error;
        }
    }

    async removeTopic(robotId: string, topic: Topic) {
        try {
            const robot = await this.getRobotFromDB(robotId);
            if (!robot) {
                throw new Error(`Robot with id ${robotId} not found`);
            }

            robot.topics = robot.topics.filter(({ id }: { id: string }) => id !== topic.id);

            if (this.selectedRobot && this.selectedRobot.id === robotId) {
                this.selectedRobot = {
                    ...this.selectedRobot,
                    topics: this.selectedRobot.topics.filter(
                        ({ id }: { id: string }) => id !== topic.id,
                    ),
                };

                if (
                    this.selectedRobot.selectedTopicId === topic.id &&
                    this.selectedRobot.topics.length > 0
                ) {
                    this.selectedRobot.selectedTopicId = this.selectedRobot.topics[0].id;
                }
            }

            await this.saveRobotToDB(robot);
            await this.updateRobotList();

            await db.topics.delete(topic.id);
        } catch (error) {
            this.logger.error('Failed to remove topic:', error);
            throw error;
        }
    }

    async updateTopic(robotId: string, topic: Topic) {
        try {
            const newTopic = { ...topic };
            newTopic.updatedAt = new Date().toISOString();

            const robot = await this.getRobotFromDB(robotId);
            if (!robot) {
                throw new Error(`Robot with id ${robotId} not found`);
            }

            robot.topics = robot.topics.map((t: Topic) => {
                const _topic = t.id === newTopic.id ? newTopic : t;
                _topic.messages = [];
                return _topic;
            });

            if (this.selectedRobot && this.selectedRobot.id === robotId) {
                this.selectedRobot = {
                    ...this.selectedRobot,
                    topics: this.selectedRobot.topics.map((t: Topic) => {
                        const _topic = t.id === newTopic.id ? newTopic : t;
                        _topic.messages = [];
                        return _topic;
                    }),
                };
            }

            await this.saveRobotToDB(robot);
            await this.updateRobotList();
        } catch (error) {
            this.logger.error('Failed to update topic:', error);
            throw error;
        }
    }

    async updateTopics(robotId: string, topics: Topic[]) {
        try {
            const robot = await this.getRobotFromDB(robotId);
            if (!robot) {
                throw new Error(`Robot with id ${robotId} not found`);
            }

            robot.topics = topics.map((topic) =>
                isEmpty(topic.messages) ? topic : { ...topic, messages: [] },
            );

            // If it's the selected robot, update that too
            if (this.selectedRobot && this.selectedRobot.id === robotId) {
                this.selectedRobot = {
                    ...this.selectedRobot,
                    topics: topics.map((topic) =>
                        isEmpty(topic.messages) ? topic : { ...topic, messages: [] },
                    ),
                };
            }

            await this.saveRobotToDB(robot);
            await this.updateRobotList();
        } catch (error) {
            this.logger.error('Failed to update topics:', error);
            throw error;
        }
    }
}

const robotDB = new RobotDB();
export default robotDB;
