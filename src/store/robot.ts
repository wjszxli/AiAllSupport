import { makeAutoObservable } from 'mobx';
import { makePersistable } from 'mobx-persist-store';
import { isEmpty, uniqBy } from 'lodash';
import { Robot, Model, Topic } from '@/types';
import { getDefaultRobot } from '@/services/RobotService';
import chromeStorageAdapter from './chromeStorageAdapter';

export class RobotStore {
    robotList: Robot[] = [getDefaultRobot()];
    selectedRobot: Robot = getDefaultRobot();

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });

        // 持久化数据存储
        makePersistable(this, {
            name: 'robot-store',
            properties: ['robotList', 'selectedRobot'],
            storage: chromeStorageAdapter as any,
        });
    }

    updateSelectedRobot(robot: Robot) {
        // 确保机器人有selectedTopicId属性
        if (!robot.selectedTopicId && robot.topics && robot.topics.length > 0) {
            robot.selectedTopicId = robot.topics[0].id;
        }

        this.selectedRobot = robot;

        // 同时更新robotList中对应的机器人
        this.robotList = this.robotList.map((r) => (r.id === robot.id ? { ...robot } : r));
    }

    updateSelectedTopic(topicId: string) {
        if (this.selectedRobot) {
            // 更新selectedRobot的selectedTopicId
            this.selectedRobot = {
                ...this.selectedRobot,
                selectedTopicId: topicId,
            };

            // 同时更新robotList中对应的机器人
            this.robotList = this.robotList.map((robot) =>
                robot.id === this.selectedRobot.id ? { ...robot, selectedTopicId: topicId } : robot,
            );
        }
    }

    updateRobotList(robotList: Robot[]) {
        this.robotList = robotList;
    }

    addRobot(robot: Robot) {
        this.robotList.push(robot);
    }

    removeRobot(id: string) {
        this.robotList = this.robotList.filter((c) => c.id !== id);
    }

    updateRobot(updatedRobot: Robot) {
        this.robotList = this.robotList.map((c) => (c.id === updatedRobot.id ? updatedRobot : c));
    }

    addTopic(robotId: string, topic: Topic) {
        topic.createdAt = topic.createdAt || new Date().toISOString();
        topic.updatedAt = topic.updatedAt || new Date().toISOString();

        this.robotList = this.robotList.map((robot) =>
            robot.id === robotId
                ? {
                      ...robot,
                      topics: uniqBy([topic, ...robot.topics], 'id'),
                  }
                : robot,
        );

        // 同时更新selectedRobot
        if (this.selectedRobot && this.selectedRobot.id === robotId) {
            this.selectedRobot = {
                ...this.selectedRobot,
                topics: uniqBy([topic, ...this.selectedRobot.topics], 'id'),
            };

            // 如果是新添加的话题，自动选中它
            this.selectedRobot.selectedTopicId = topic.id;
        }
    }

    removeTopic(robotId: string, topic: Topic) {
        this.robotList = this.robotList.map((robot) =>
            robot.id === robotId
                ? {
                      ...robot,
                      topics: robot.topics.filter(({ id }) => id !== topic.id),
                  }
                : robot,
        );

        // 同时更新selectedRobot
        if (this.selectedRobot && this.selectedRobot.id === robotId) {
            this.selectedRobot = {
                ...this.selectedRobot,
                topics: this.selectedRobot.topics.filter(({ id }) => id !== topic.id),
            };
        }
    }

    updateTopic(robotId: string, topic: Topic) {
        const newTopic = topic;
        newTopic.updatedAt = new Date().toISOString();

        this.robotList = this.robotList.map((robot) =>
            robot.id === robotId
                ? {
                      ...robot,
                      topics: robot.topics.map((t) => {
                          const _topic = t.id === newTopic.id ? newTopic : t;
                          _topic.messages = [];
                          return _topic;
                      }),
                  }
                : robot,
        );

        // 同时更新selectedRobot
        if (this.selectedRobot && this.selectedRobot.id === robotId) {
            this.selectedRobot = {
                ...this.selectedRobot,
                topics: this.selectedRobot.topics.map((t) => {
                    const _topic = t.id === newTopic.id ? newTopic : t;
                    _topic.messages = [];
                    return _topic;
                }),
            };
        }
    }

    updateTopics(robotId: string, topics: Topic[]) {
        this.robotList = this.robotList.map((robot) =>
            robot.id === robotId
                ? {
                      ...robot,
                      topics: topics.map((topic) =>
                          isEmpty(topic.messages) ? topic : { ...topic, messages: [] },
                      ),
                  }
                : robot,
        );
    }

    setModel(robotId: string, model: Model) {
        this.robotList = this.robotList.map((robot) =>
            robot.id === robotId
                ? {
                      ...robot,
                      model: model,
                  }
                : robot,
        );
    }
}

// 创建单例实例
const robotStore = new RobotStore();
export default robotStore;
