import { Message } from '@/types/message';
import { MessageBlock } from '@/types/messageBlock';
import { Dexie, type EntityTable } from 'dexie';

export const db = new Dexie('CherryStudio') as Dexie & {
    topic: EntityTable<{ id: string; messages: Message[] }, 'id'>;
    message_blocks: EntityTable<MessageBlock, 'id'>;
};

db.version(1).stores({
    topics: '&id, messages',
    message_blocks: 'id, messageId',
});
