// src/renderer/src/store/rootStore.ts
import { createContext, useContext } from 'react';
import llmStore from './llm';
import robotStore from './robot';

class RootStore {
    llmStore = llmStore;
    robotStore = robotStore;

    constructor() {}
}

const rootStore = new RootStore();

const StoreContext = createContext<RootStore>(rootStore);
export const useStore = () => useContext(StoreContext);

export default rootStore;
