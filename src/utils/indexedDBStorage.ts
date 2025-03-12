import type { ChatMessage } from '@/typings';

// Database name and version
const DB_NAME = 'DeepSeekChatsDB';
const DB_VERSION = 1;

// Store names for different components
const CHAT_APP_STORE = 'chatAppMessages';
const CHAT_INTERFACE_STORE = 'chatInterfaceMessages';

// Initialize the database
export const initDatabase = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event);
            reject('Failed to open database');
        };

        request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create store for chat App messages if it doesn't exist
            if (!db.objectStoreNames.contains(CHAT_APP_STORE)) {
                db.createObjectStore(CHAT_APP_STORE, { keyPath: 'conversationId' });
            }

            // Create store for chat interface messages if it doesn't exist
            if (!db.objectStoreNames.contains(CHAT_INTERFACE_STORE)) {
                db.createObjectStore(CHAT_INTERFACE_STORE, { keyPath: 'conversationId' });
            }
        };
    });
};

// Generic function to save messages to a specific store
const saveMessages = async (
    storeName: string,
    conversationId: string,
    messages: ChatMessage[],
): Promise<void> => {
    const db = await initDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        const request = store.put({
            conversationId,
            messages,
            updatedAt: new Date().toISOString(),
        });

        request.onsuccess = () => resolve();
        request.onerror = () => reject('Failed to save messages');

        transaction.oncomplete = () => db.close();
    });
};

// Generic function to get messages from a specific store
const getMessages = async (storeName: string, conversationId: string): Promise<ChatMessage[]> => {
    const db = await initDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);

        const request = store.get(conversationId);

        request.onsuccess = (event) => {
            const result = (event.target as IDBRequest).result;
            resolve(result ? result.messages : []);
        };

        request.onerror = () => reject('Failed to retrieve messages');

        transaction.oncomplete = () => db.close();
    });
};

// Generic function to delete a conversation from a specific store
const deleteConversation = async (storeName: string, conversationId: string): Promise<void> => {
    const db = await initDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        const request = store.delete(conversationId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject('Failed to delete conversation');

        transaction.oncomplete = () => db.close();
    });
};

// Generic function to list all conversations in a specific store
const listConversations = async (storeName: string): Promise<string[]> => {
    const db = await initDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);

        const request = store.getAllKeys();

        request.onsuccess = (event) => {
            const result = (event.target as IDBRequest).result;
            resolve(result as string[]);
        };

        request.onerror = () => reject('Failed to list conversations');

        transaction.oncomplete = () => db.close();
    });
};

// Specific functions for Chat App component
export const saveChatAppMessages = (
    conversationId: string,
    messages: ChatMessage[],
): Promise<void> => {
    return saveMessages(CHAT_APP_STORE, conversationId, messages);
};

export const getChatAppMessages = (conversationId: string): Promise<ChatMessage[]> => {
    return getMessages(CHAT_APP_STORE, conversationId);
};

export const deleteChatAppConversation = (conversationId: string): Promise<void> => {
    return deleteConversation(CHAT_APP_STORE, conversationId);
};

export const listChatAppConversations = (): Promise<string[]> => {
    return listConversations(CHAT_APP_STORE);
};

// Specific functions for Chat Interface component
export const saveChatInterfaceMessages = (
    conversationId: string,
    messages: ChatMessage[],
): Promise<void> => {
    return saveMessages(CHAT_INTERFACE_STORE, conversationId, messages);
};

export const getChatInterfaceMessages = (conversationId: string): Promise<ChatMessage[]> => {
    return getMessages(CHAT_INTERFACE_STORE, conversationId);
};

export const deleteChatInterfaceConversation = (conversationId: string): Promise<void> => {
    return deleteConversation(CHAT_INTERFACE_STORE, conversationId);
};

export const listChatInterfaceConversations = (): Promise<string[]> => {
    return listConversations(CHAT_INTERFACE_STORE);
};
