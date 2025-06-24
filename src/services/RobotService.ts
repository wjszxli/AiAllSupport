import { Robot, Topic } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { robotList } from '../config/robot';
import { t } from '@/locales/i18n';
import robotDB from '@/store/robot';

export function getDefaultTopic(assistantId: string): Topic {
    const now = new Date().toISOString();
    return {
        id: uuidv4(),
        assistantId,
        createdAt: now,
        updatedAt: now,
        name: t('defaultTopicName'),
        messages: [],
        isNameManuallyEdited: false,
    };
}

// 获取网页总结机器人
export function getWebSummarizerRobot(): Robot | undefined {
    const webSummarizerRobot = robotList.find((robot) => robot.id === '782');
    if (webSummarizerRobot) {
        const topics = getDefaultTopic(webSummarizerRobot.id);
        return {
            ...webSummarizerRobot,
            type: 'assistant',
            topics: [topics],
            isSystem: true, // 标记为系统机器人
            cannotDelete: true, // 标记为不可删除
            selectedTopicId: topics.id,
        };
    }
    return undefined;
}

export async function existWebSummarizerRobot(): Promise<boolean> {
    const webSummarizerRobot = await robotDB.getRobotFromDB('782');
    console.log('webSummarizerRobot', webSummarizerRobot);
    return webSummarizerRobot !== undefined;
}

// 获取默认机器人
export function getDefaultRobot(): Robot {
    const robots = robotList[0];
    const defaultTopic = getDefaultTopic(robots.id);
    const defaultRobots = {
        ...robots,
        type: 'assistant',
        topics: [defaultTopic],
        selectedTopicId: defaultTopic.id, // 设置默认选中的话题
        isSystem: true, // 标记为系统机器人
        cannotDelete: true, // 标记为不可删除
    };

    return defaultRobots;
}
