import { createContext, useContext } from 'react';
import llmStore from './llm';
import robotDB from '@/store/robot'; // Import the new robotDB
import { MessageStore } from './MessageStore';
import { MessageBlockStore } from './MessageBlockStore';
import settingStore from './setting';

export class RootStore {
    llmStore = llmStore;
    robotStore = robotDB; // Use robotDB instead of robotStore
    messageStore: MessageStore;
    messageBlockStore: MessageBlockStore;
    settingStore = settingStore;

    constructor() {
        this.messageStore = new MessageStore();
        this.messageBlockStore = new MessageBlockStore();
    }
}

const rootStore = new RootStore();

const StoreContext = createContext<RootStore>(rootStore);
export const useStore = () => useContext(StoreContext);

export default rootStore;
