import rootStore from '@/store';
import { Assistant, Topic } from '@/types';
import * as uuid from 'uuid';
// import { t } from '@/services/i18n';

export function getDefaultModel() {
    const store = rootStore;
    return store.llmStore.defaultModel;
}

export function getDefaultTopic(assistantId: string): Topic {
    const now = new Date().toISOString();
    return {
        id: uuid.v4(),
        assistantId,
        createdAt: now,
        updatedAt: now,
        // name: t('defaultTopicName'),
        name: 'wjs',
        messages: [],
        isNameManuallyEdited: false,
    };
}

export function getDefaultAssistant(): Assistant {
    return {
        id: 'default',
        // name: t('chat.default.name'),
        // name: t('defaultTopicName'),
        name: 'zxli',
        emoji: '😀',
        prompt: '',
        topics: [getDefaultTopic('default')],
        messages: [],
        type: 'assistant',
    };
}
