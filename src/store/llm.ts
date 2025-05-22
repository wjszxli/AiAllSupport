// src/renderer/src/store/llmStore.ts
import { makeAutoObservable } from 'mobx';
import { makePersistable } from 'mobx-persist-store';
// import { isLocalAi } from '@renderer/config/env';
import { uniqBy } from 'lodash';
import chromeStorageAdapter from './chromeStorageAdapter';
import { Model, Provider } from '@/types';
import { SYSTEM_MODELS } from '../config/models';
import { INITIAL_PROVIDERS } from '../config/providers';

class LlmStore {
    providers: Provider[] = INITIAL_PROVIDERS;
    defaultModel: Model;

    constructor() {
        makeAutoObservable(this);

        // 持久化数据存储
        makePersistable(this, {
            name: 'llm-store',
            properties: ['providers', 'defaultModel'],
            storage: chromeStorageAdapter as any,
        });

        this.defaultModel = SYSTEM_MODELS.silicon[0];
    }

    // 转换为动作方法
    updateProvider = (provider: Provider) => {
        this.providers = this.providers.map((p) =>
            p.id === provider.id ? { ...p, ...provider } : p,
        );
    };

    updateProviders = (providers: Provider[]) => {
        this.providers = providers;
    };

    addProvider = (provider: Provider) => {
        this.providers.unshift(provider);
    };

    removeProvider = (provider: Provider) => {
        const index = this.providers.findIndex((p) => p.id === provider.id);
        if (index !== -1) {
            this.providers.splice(index, 1);
        }
    };

    addModel = (providerId: string, model: Model) => {
        const provider = this.providers.find((p) => p.id === providerId);
        if (provider) {
            provider.models = uniqBy([...provider.models, model], 'id');
            provider.enabled = true;
        }
    };

    removeModel = (providerId: string, model: Model) => {
        const provider = this.providers.find((p) => p.id === providerId);
        if (provider) {
            provider.models = provider.models.filter((m: { id: any }) => m.id !== model.id);
        }
    };

    setDefaultModel = (model: Model) => {
        this.defaultModel = model;
    };

    updateModel = (providerId: string, model: Model) => {
        const provider = this.providers.find((p) => p.id === providerId);
        if (provider) {
            const modelIndex = provider.models.findIndex((m: { id: any }) => m.id === model.id);
            if (modelIndex !== -1) {
                provider.models[modelIndex] = model;
            }
        }
    };

    moveProvider = (id: string, position: number) => {
        const index = this.providers.findIndex((p) => p.id === id);
        if (index === -1) return;

        const provider = this.providers[index];
        this.providers.splice(index, 1);
        this.providers.splice(position - 1, 0, provider);
    };
}

// 创建并导出单例实例
const llmStore = new LlmStore();
export default llmStore;
