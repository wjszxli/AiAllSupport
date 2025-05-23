// src/renderer/src/store/rootStore.ts
import { createContext, useContext } from 'react';
import llmStore from './llm';
import assistantsStore from './assistants';

class RootStore {
    llmStore = llmStore;
    assistantsStore = assistantsStore;

    constructor() {}
}

const rootStore = new RootStore();

const StoreContext = createContext<RootStore>(rootStore);
export const useStore = () => useContext(StoreContext);

export default rootStore;
