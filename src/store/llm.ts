// src/renderer/src/store/llmStore.ts
import { makeAutoObservable } from 'mobx';
import { makePersistable } from 'mobx-persist-store';
// import { isLocalAi } from '@renderer/config/env';
import { uniqBy } from 'lodash';
import chromeStorageAdapter from './chromeStorageAdapter';
import { ConfigModelType, Model, Provider } from '@/types';
import { SYSTEM_MODELS } from '../config/models';
import { INITIAL_PROVIDERS } from '../config/providers';
import robotStore from './robot';

class LlmStore {
    providers: Provider[] = INITIAL_PROVIDERS;
    chatModel: Model;
    popupModel: Model;
    sidebarModel: Model;

    constructor() {
        makeAutoObservable(this);

        // 持久化数据存储
        makePersistable(this, {
            name: 'llm-store',
            properties: ['providers', 'chatModel', 'popupModel', 'sidebarModel'],
            storage: chromeStorageAdapter as any,
        });

        this.chatModel = SYSTEM_MODELS.silicon[0];
        this.popupModel = SYSTEM_MODELS.silicon[0];
        this.sidebarModel = SYSTEM_MODELS.silicon[0];
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

    // 设置特定场景的模型
    setModelForType = (type: ConfigModelType, model: Model) => {
        switch (type) {
            case ConfigModelType.CHAT:
                this.chatModel = model;

                // 更新当前选中的机器人的模型
                if (robotStore.selectedRobot && robotStore.selectedRobot.id) {
                    const updatedRobot = {
                        ...robotStore.selectedRobot,
                        model: model,
                    };

                    // 异步更新机器人，但不等待结果
                    robotStore.updateRobot(updatedRobot).catch((error) => {
                        console.error('Failed to update robot model:', error);
                    });
                }
                break;
            case ConfigModelType.POPUP:
                this.popupModel = model;
                break;
            case ConfigModelType.SIDEBAR:
                this.sidebarModel = model;
                break;
        }
    };

    // 获取特定场景的模型
    getModelForType = (type: ConfigModelType): Model => {
        switch (type) {
            case ConfigModelType.CHAT:
                return this.chatModel;
            case ConfigModelType.POPUP:
                return this.popupModel || this.chatModel;
            case ConfigModelType.SIDEBAR:
                return this.sidebarModel || this.chatModel;
            default:
                return this.chatModel;
        }
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

const llmStore = new LlmStore();
export default llmStore;
