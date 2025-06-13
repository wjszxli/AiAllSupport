import { Robot, Model, Topic } from '@/types';
import { db } from './index';
import { makePersistable } from 'mobx-persist-store';
import { makeAutoObservable } from 'mobx';
import { isEmpty, uniqBy } from 'lodash';
import { getDefaultRobot } from '@/services/RobotService';
import chromeStorageAdapter from '@/store/chromeStorageAdapter';

// Extend the Dexie database to include robots
db.version(2).stores({
    robots: '&id, name',
    topics: '&id, messages',
    message_blocks: 'id, messageId',
});

// Create a class to manage robot data using DB
export class RobotDB {
    robotList: Robot[] = [getDefaultRobot()];
    selectedRobot: Robot = getDefaultRobot();

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });

        // Initialize the robot list from DB
        this.initializeFromDB();

        // Maintain compatibility with previous storage
        makePersistable(this, {
            name: 'robot-store',
            properties: ['selectedRobot'],
            storage: chromeStorageAdapter as any,
        });
    }

    async initializeFromDB() {
        try {
            // Get all robots from DB
            const robots = await db.table('robots').toArray();

            // If there are no robots in DB, initialize with default and save to DB
            if (robots.length === 0) {
                await this.saveRobotToDB(getDefaultRobot());
            } else {
                this.robotList = robots;
                // If there's no selected robot, select the first one
                if (!this.selectedRobot?.id) {
                    this.selectedRobot = robots[0];
                }
            }
        } catch (error) {
            console.error('Failed to initialize robots from DB:', error);
        }
    }

    async saveRobotToDB(robot: Robot) {
        try {
            await db.table('robots').put(JSON.parse(JSON.stringify(robot)));
            return robot;
        } catch (error) {
            console.error('Failed to save robot to DB:', error);
            throw error;
        }
    }

    async getRobotFromDB(robotId: string) {
        try {
            return await db.table('robots').get(robotId);
        } catch (error) {
            console.error('Failed to get robot from DB:', error);
            throw error;
        }
    }

    async deleteRobotFromDB(robotId: string) {
        try {
            await db.table('robots').delete(robotId);
        } catch (error) {
            console.error('Failed to delete robot from DB:', error);
            throw error;
        }
    }

    async getAllRobotsFromDB() {
        try {
            return await db.table('robots').toArray();
        } catch (error) {
            console.error('Failed to get all robots from DB:', error);
            throw error;
        }
    }

    // Methods to update the store state and database
    async updateSelectedRobot(robot: Robot) {
        // Ensure robot has selectedTopicId property
        if (!robot.selectedTopicId && robot.topics && robot.topics.length > 0) {
            robot.selectedTopicId = robot.topics[0].id;
        }

        this.selectedRobot = robot;

        // Update the robot in the list and DB
        await this.updateRobot(robot);
    }

    async updateSelectedTopic(topicId: string) {
        if (this.selectedRobot) {
            // Update selectedRobot's selectedTopicId
            this.selectedRobot = {
                ...this.selectedRobot,
                selectedTopicId: topicId,
            };

            // Update in DB
            await this.updateRobot(this.selectedRobot);
        }
    }

    async updateRobotList() {
        try {
            // Get all robots from DB
            const robots = await this.getAllRobotsFromDB();
            this.robotList = robots;
        } catch (error) {
            console.error('Failed to update robot list:', error);
        }
    }

    async addRobot(robot: Robot) {
        try {
            // Save to DB
            await this.saveRobotToDB(robot);
            // Update local list
            await this.updateRobotList();
        } catch (error) {
            console.error('Failed to add robot:', error);
            throw error;
        }
    }

    async removeRobot(id: string) {
        try {
            // Delete from DB
            await this.deleteRobotFromDB(id);
            // Update local list
            await this.updateRobotList();
        } catch (error) {
            console.error('Failed to remove robot:', error);
            throw error;
        }
    }

    async updateRobot(updatedRobot: Robot) {
        try {
            // Save to DB
            await this.saveRobotToDB(updatedRobot);

            // Update local list
            const index = this.robotList.findIndex((r) => r.id === updatedRobot.id);
            if (index !== -1) {
                this.robotList[index] = updatedRobot;
            }

            // If it's the selected robot, update that too
            if (this.selectedRobot.id === updatedRobot.id) {
                this.selectedRobot = updatedRobot;
            }
        } catch (error) {
            console.error('Failed to update robot:', error);
            throw error;
        }
    }

    async addTopic(robotId: string, topic: Topic) {
        try {
            topic.createdAt = topic.createdAt || new Date().toISOString();
            topic.updatedAt = topic.updatedAt || new Date().toISOString();

            // Get the robot
            const robot = await this.getRobotFromDB(robotId);
            if (!robot) {
                throw new Error(`Robot with id ${robotId} not found`);
            }

            // Add the topic
            robot.topics = uniqBy([topic, ...robot.topics], 'id');

            // If it's the selected robot, update that too
            if (this.selectedRobot && this.selectedRobot.id === robotId) {
                this.selectedRobot = {
                    ...this.selectedRobot,
                    topics: uniqBy([topic, ...this.selectedRobot.topics], 'id'),
                    selectedTopicId: topic.id, // Auto-select new topic
                };
            }

            // Save to DB
            await this.saveRobotToDB(robot);
            await this.updateRobotList();

            // Add empty messages array for the topic
            await db.topics.add({
                id: topic.id,
                messages: [],
            });
        } catch (error) {
            console.error('Failed to add topic:', error);
            throw error;
        }
    }

    async removeTopic(robotId: string, topic: Topic) {
        try {
            // Get the robot
            const robot = await this.getRobotFromDB(robotId);
            if (!robot) {
                throw new Error(`Robot with id ${robotId} not found`);
            }

            // Remove the topic
            robot.topics = robot.topics.filter(({ id }: { id: string }) => id !== topic.id);

            // If it's the selected robot, update that too
            if (this.selectedRobot && this.selectedRobot.id === robotId) {
                this.selectedRobot = {
                    ...this.selectedRobot,
                    topics: this.selectedRobot.topics.filter(
                        ({ id }: { id: string }) => id !== topic.id,
                    ),
                };

                // If the removed topic was selected, select another one
                if (
                    this.selectedRobot.selectedTopicId === topic.id &&
                    this.selectedRobot.topics.length > 0
                ) {
                    this.selectedRobot.selectedTopicId = this.selectedRobot.topics[0].id;
                }
            }

            // Save to DB
            await this.saveRobotToDB(robot);
            await this.updateRobotList();

            // Delete the topic from the topics store
            await db.topics.delete(topic.id);
        } catch (error) {
            console.error('Failed to remove topic:', error);
            throw error;
        }
    }

    async updateTopic(robotId: string, topic: Topic) {
        try {
            const newTopic = { ...topic };
            newTopic.updatedAt = new Date().toISOString();

            // Get the robot
            const robot = await this.getRobotFromDB(robotId);
            if (!robot) {
                throw new Error(`Robot with id ${robotId} not found`);
            }

            // Update the topic
            robot.topics = robot.topics.map((t: Topic) => {
                const _topic = t.id === newTopic.id ? newTopic : t;
                _topic.messages = [];
                return _topic;
            });

            // If it's the selected robot, update that too
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

            // Save to DB
            await this.saveRobotToDB(robot);
            await this.updateRobotList();
        } catch (error) {
            console.error('Failed to update topic:', error);
            throw error;
        }
    }

    async updateTopics(robotId: string, topics: Topic[]) {
        try {
            // Get the robot
            const robot = await this.getRobotFromDB(robotId);
            if (!robot) {
                throw new Error(`Robot with id ${robotId} not found`);
            }

            // Update the topics
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

            // Save to DB
            await this.saveRobotToDB(robot);
            await this.updateRobotList();
        } catch (error) {
            console.error('Failed to update topics:', error);
            throw error;
        }
    }

    async setModel(robotId: string, model: Model) {
        try {
            // Get the robot
            const robot = await this.getRobotFromDB(robotId);
            if (!robot) {
                throw new Error(`Robot with id ${robotId} not found`);
            }

            // Update the model
            robot.model = model;

            // If it's the selected robot, update that too
            if (this.selectedRobot && this.selectedRobot.id === robotId) {
                this.selectedRobot = {
                    ...this.selectedRobot,
                    model,
                };
            }

            // Save to DB
            await this.saveRobotToDB(robot);
            await this.updateRobotList();
        } catch (error) {
            console.error('Failed to set model:', error);
            throw error;
        }
    }
}

// Create single instance
const robotDB = new RobotDB();
export default robotDB;
