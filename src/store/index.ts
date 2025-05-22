// src/renderer/src/store/rootStore.ts
import { createContext, useContext } from 'react';
import llmStore from './llm';

class RootStore {
    llmStore = llmStore;
    // 添加其他 store 实例

    constructor() {
        // 初始化逻辑
    }
}

const rootStore = new RootStore();

const StoreContext = createContext<RootStore>(rootStore);
export const useStore = () => useContext(StoreContext);

export default rootStore;
