import { createContext, useContext } from 'react';
import llmStore from './llm';
import robotStore from './robot';
import { MessageStore } from './MessageStore';
import { MessageBlockStore } from './MessageBlockStore';

export class RootStore {
    llmStore = llmStore;
    robotStore = robotStore;
    messageStore: MessageStore;
    messageBlockStore: MessageBlockStore;

    constructor() {
        this.messageStore = new MessageStore();
        this.messageBlockStore = new MessageBlockStore();
    }
}

const rootStore = new RootStore();

const StoreContext = createContext<RootStore>(rootStore);
export const useStore = () => useContext(StoreContext);

export default rootStore;
