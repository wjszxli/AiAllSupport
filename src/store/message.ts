import { Message } from '@/types/message';
import { makeAutoObservable } from 'mobx';

class MessageStore {
    messageEntities: Record<string, Message> = {};
    messageIdsByTopic: Record<string, string[]> = {};

    constructor() {
        makeAutoObservable(this);
    }

    getMessagesForTopic(topicId: string): Message[] {
        const topicMessageIds = this.messageIdsByTopic[topicId];
        if (!topicMessageIds) {
            return [];
        }
        return topicMessageIds
            .map((id) => this.messageEntities[id])
            .filter((m): m is Message => !!m);
    }
}

const messageStore = new MessageStore();
export default messageStore;
