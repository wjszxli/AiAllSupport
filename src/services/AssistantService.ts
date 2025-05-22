import rootStore from '@/store';

export function getDefaultModel() {
    const store = rootStore;
    return store.llmStore.defaultModel;
}
