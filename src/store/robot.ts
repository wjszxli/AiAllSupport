import { makeAutoObservable } from 'mobx';

import { Robot, Model, Topic } from '@/types';
import robotDB from '@/db/robotDB';

// For exposing the robot edit functionality
export type EditRobotHandler = (robot: Robot) => void;
let editRobotHandler: EditRobotHandler | null = null;

/**
 * 这个类现在是一个代理，将所有操作转发到 robotDB
 * 保留此类是为了向后兼容性，新代码应该直接使用 robotDB
 */
export class RobotStore {
    get robotList() {
        return robotDB.robotList;
    }

    get selectedRobot() {
        return robotDB.selectedRobot;
    }

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    // 设置机器人编辑处理函数
    setEditRobotHandler(handler: EditRobotHandler | null) {
        editRobotHandler = handler;
    }

    // 打开机器人编辑界面
    openEditRobot(robot: Robot) {
        if (editRobotHandler) {
            editRobotHandler(robot);
        } else {
            console.warn('Robot edit handler not set');
        }
    }

    async updateSelectedRobot(robot: Robot) {
        await robotDB.updateSelectedRobot(robot);
    }

    async updateSelectedTopic(topicId: string) {
        await robotDB.updateSelectedTopic(topicId);
    }

    async updateRobotList(robotList: Robot[]) {
        // 这个方法在 robotDB 中不存在直接对应的方法
        // 但可以通过循环更新每个机器人来实现相同的效果
        for (const robot of robotList) {
            await robotDB.updateRobot(robot);
        }
    }

    async addRobot(robot: Robot) {
        await robotDB.addRobot(robot);
    }

    async removeRobot(id: string) {
        await robotDB.removeRobot(id);
    }

    async updateRobot(updatedRobot: Robot) {
        await robotDB.updateRobot(updatedRobot);
    }

    async addTopic(robotId: string, topic: Topic) {
        await robotDB.addTopic(robotId, topic);
    }

    async removeTopic(robotId: string, topic: Topic) {
        await robotDB.removeTopic(robotId, topic);
    }

    async updateTopic(robotId: string, topic: Topic) {
        await robotDB.updateTopic(robotId, topic);
    }

    async updateTopics(robotId: string, topics: Topic[]) {
        await robotDB.updateTopics(robotId, topics);
    }

    async setModel(robotId: string, model: Model) {
        await robotDB.setModel(robotId, model);
    }
}

// 创建单例实例
const robotStore = new RobotStore();
export default robotStore;
