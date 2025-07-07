import type { Message } from '@/types/message';
import type { MessageBlock } from '@/types/messageBlock';
import type { Robot } from '@/types';
import { Dexie } from 'dexie';
import type { Table, EntityTable } from 'dexie';

export const db = new Dexie('AiDb') as Dexie & {
    topics: EntityTable<{ id: string; messages: Message[] }, 'id'>;
    message_blocks: EntityTable<MessageBlock, 'id'>;
    robots: EntityTable<Robot, 'id'>;
    settings: Table<{ key: string; value: any }>;
};

db.version(1).stores({
    topics: '&id, messages',
    message_blocks: 'id, messageId',
});

// Add robots table in version 2
db.version(2).stores({
    robots: '&id, name',
});

db.version(3).stores({
    robots: '&id, name',
    topics: '&id, messages',
    message_blocks: 'id, messageId',
});

// Add settings table in version 4
db.version(4).stores({
    robots: '&id, name',
    topics: '&id, messages',
    message_blocks: 'id, messageId',
    settings: '&key, value',
});
