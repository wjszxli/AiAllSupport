import { Robot, Topic } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { robotList } from '../config/robot';
import { t } from '@/locales/i18n';

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

export function getDefaultRobot(): Robot {
    const robots = robotList;
    return {
        ...robots[0],
        type: 'assistant',
        topics: [getDefaultTopic(robots[0].id)],
    };
}
