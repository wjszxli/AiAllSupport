import { makeAutoObservable } from 'mobx';
import { isEmpty, uniqBy } from 'lodash';
import { Assistant, Model, Topic } from '@/types';
import { getDefaultAssistant } from '@/services/AssistantService';

export class AssistantsStore {
    // defaultAssistant: Assistant = getDefaultAssistant();
    assistants: Assistant[] = [getDefaultAssistant()];
    // assistants: Assistant[] = [];
    defaultAssistant: Assistant | null = null;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    updateDefaultAssistant(assistant: Assistant) {
        this.defaultAssistant = assistant;
    }

    updateAssistants(assistants: Assistant[]) {
        this.assistants = assistants;
    }

    addAssistant(assistant: Assistant) {
        this.assistants.push(assistant);
    }

    removeAssistant(id: string) {
        this.assistants = this.assistants.filter((c) => c.id !== id);
    }

    updateAssistant(updatedAssistant: Assistant) {
        this.assistants = this.assistants.map((c) =>
            c.id === updatedAssistant.id ? updatedAssistant : c,
        );
    }

    addTopic(assistantId: string, topic: Topic) {
        topic.createdAt = topic.createdAt || new Date().toISOString();
        topic.updatedAt = topic.updatedAt || new Date().toISOString();

        this.assistants = this.assistants.map((assistant) =>
            assistant.id === assistantId
                ? {
                      ...assistant,
                      topics: uniqBy([topic, ...assistant.topics], 'id'),
                  }
                : assistant,
        );
    }

    removeTopic(assistantId: string, topic: Topic) {
        this.assistants = this.assistants.map((assistant) =>
            assistant.id === assistantId
                ? {
                      ...assistant,
                      topics: assistant.topics.filter(({ id }) => id !== topic.id),
                  }
                : assistant,
        );
    }

    updateTopic(assistantId: string, topic: Topic) {
        const newTopic = topic;
        newTopic.updatedAt = new Date().toISOString();

        this.assistants = this.assistants.map((assistant) =>
            assistant.id === assistantId
                ? {
                      ...assistant,
                      topics: assistant.topics.map((t) => {
                          const _topic = t.id === newTopic.id ? newTopic : t;
                          _topic.messages = [];
                          return _topic;
                      }),
                  }
                : assistant,
        );
    }

    updateTopics(assistantId: string, topics: Topic[]) {
        this.assistants = this.assistants.map((assistant) =>
            assistant.id === assistantId
                ? {
                      ...assistant,
                      topics: topics.map((topic) =>
                          isEmpty(topic.messages) ? topic : { ...topic, messages: [] },
                      ),
                  }
                : assistant,
        );
    }

    setModel(assistantId: string, model: Model) {
        this.assistants = this.assistants.map((assistant) =>
            assistant.id === assistantId
                ? {
                      ...assistant,
                      model: model,
                  }
                : assistant,
        );
    }
}

// 创建单例实例
const assistantsStore = new AssistantsStore();
export default assistantsStore;
