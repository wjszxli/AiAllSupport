// src/renderer/src/store/llmStore.ts
import { makeAutoObservable } from 'mobx';
import { makePersistable } from 'mobx-persist-store';
// import { isLocalAi } from '@renderer/config/env';
import { uniqBy } from 'lodash';
import chromeStorageAdapter from './chromeStorageAdapter';
import type { Model, Provider, Robot } from '@/types';
import { ConfigModelType } from '@/types';
import { SYSTEM_MODELS } from '../config/models';
import { INITIAL_PROVIDERS } from '../config/providers';
import robotStore from './robot';
import { Logger } from '@/utils/logger';
import { mapLegacyNameToId } from '@/utils';

const logger = new Logger('llmStore');
class LlmStore {
    providers: Provider[] = INITIAL_PROVIDERS;
    chatModel: Model;
    popupModel: Model;
    sidebarModel: Model;
    chatRobot: Robot | null = null;
    popupRobot: Robot | null = null;
    sidebarRobot: Robot | null = null;
    // Migration state
    isMigratingProviders = false;
    isMigratingSelection = false;
    migrationCompleted = false;

    constructor() {
        makeAutoObservable(this);

        this.chatModel = SYSTEM_MODELS.silicon[0];
        this.popupModel = SYSTEM_MODELS.silicon[0];
        this.sidebarModel = SYSTEM_MODELS.silicon[0];

        // Run legacy migrations (providers and selections) independently
        this.runLegacyMigrationsIfNeeded().catch((e) => {
            console.warn('[llmStore] Legacy migrations failed:', e);
        });

        // 持久化数据存储
        makePersistable(this, {
            name: 'llm-store',
            properties: [
                'providers',
                'chatModel',
                'popupModel',
                'sidebarModel',
                'chatRobot',
                'popupRobot',
                'sidebarRobot',
            ],
            storage: chromeStorageAdapter as any,
        });
    }

    private async runLegacyMigrationsIfNeeded(): Promise<void> {
        // Detect legacy presence first
        const needProviders = await this.checkLegacyProvidersNeeded();
        const needSelection = await this.checkLegacySelectionNeeded();
        if (!needProviders && !needSelection) {
            return;
        }
        try {
            // Notify UI that migration is starting
            window.dispatchEvent(new CustomEvent('legacyMigrationStart'));
        } catch {}

        try {
            if (needProviders) {
                this.isMigratingProviders = true;
                await this.migrateLegacyProviders();
            }
        } finally {
            this.isMigratingProviders = false;
        }

        try {
            if (needSelection) {
                this.isMigratingSelection = true;
                await this.migrateLegacySelectedProvider();
            }
        } finally {
            this.isMigratingSelection = false;
        }

        this.migrationCompleted = true;
        try {
            window.dispatchEvent(new CustomEvent('legacyMigrationEnd'));
        } catch {}
    }

    private async checkLegacyProvidersNeeded(): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            chrome.storage.local.get(['providers'], (result) => {
                resolve(!!(result && result.providers));
            });
        });
    }

    private async checkLegacySelectionNeeded(): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            chrome.storage.local.get(['selectedProvider'], (result) => {
                resolve(!!(result && result.selectedProvider));
            });
        });
    }

    // Migrate legacy providers config (apiKey, apiHost, enabled)
    private async migrateLegacyProviders(): Promise<void> {
        try {
            logger.info('migrateLegacyProviders');

            // Load legacy provider config
            const legacyKeys = ['providers', 'selectedProvider'] as const;
            const legacy = await new Promise<Record<string, any>>((resolve) => {
                chrome.storage.local.get(legacyKeys as unknown as string[], (result) =>
                    resolve(result || {}),
                );
            });

            logger.info('legacy.providers', legacy?.providers);

            const legacyProviders = legacy.providers as
                | Record<
                      string,
                      {
                          apiKey?: string | null;
                          apiHost?: string;
                          selected?: boolean;
                          selectedModel?: string | null;
                      }
                  >
                | undefined;
            if (!legacyProviders || Object.keys(legacyProviders).length === 0) {
                return; // Nothing to migrate
            }

            // Start from system defaults
            const migratedProviders = INITIAL_PROVIDERS.map((p) => ({ ...p }));

            // Apply legacy values
            Object.entries(legacyProviders).forEach(([legacyName, cfg]) => {
                const id = mapLegacyNameToId(legacyName);
                if (!id) return;
                const provider = migratedProviders.find((p) => p.id === id);
                if (!provider) return;

                if (typeof cfg.apiKey !== 'undefined' && cfg.apiKey !== null) {
                    provider.apiKey = cfg.apiKey;
                }
                if (typeof cfg.apiHost === 'string' && cfg.apiHost.trim()) {
                    provider.apiHost = cfg.apiHost.trim();
                }
                if (typeof cfg.selected === 'boolean') {
                    provider.enabled = cfg.selected;
                } else if (cfg.apiKey) {
                    // If no explicit selected flag, enable when apiKey exists
                    provider.enabled = true;
                }
                logger.info('provider', provider);
            });

            // Apply providers to store
            this.providers = migratedProviders;

            // Best-effort: remove legacy provider keys (providers only)
            chrome.storage.local.remove(['providers']);
            console.info('[llmStore] Legacy providers migrated.');
        } catch (error) {
            console.warn('[llmStore] migrateLegacyProviders error:', error);
        }
    }

    // Migrate legacy selectedProvider/selectedModel into chat/popup/sidebar models
    private async migrateLegacySelectedProvider(): Promise<void> {
        try {
            logger.info('migrateLegacySelectedProvider');

            const legacyKeys = ['selectedProvider'] as const;
            const legacy = await new Promise<Record<string, any>>((resolve) => {
                chrome.storage.local.get(legacyKeys as unknown as string[], (result) =>
                    resolve(result || {}),
                );
            });

            const legacySelectedProvider = legacy.selectedProvider as string | undefined;

            if (!legacySelectedProvider) {
                logger.info('no legacySelectedProvider');
                chrome.storage.local.remove(['selectedProvider']);
                return;
            }

            let chosenModel = this.chatModel;
            const legacySelectedModel = this.providers.find(
                (p) => p.id === mapLegacyNameToId(legacySelectedProvider),
            );

            logger.info('legacySelectedModel', legacySelectedModel);

            if (!legacySelectedModel) {
                logger.info('no legacySelectedModel');
                return;
            }

            if (!legacySelectedModel.apiKey) {
                logger.info('no apiKey');
                return;
            }

            if (legacySelectedModel.models.length > 0) {
                chosenModel = legacySelectedModel.models[0];
            }

            // Apply to three UI contexts
            this.chatModel = chosenModel;
            this.popupModel = chosenModel;
            this.sidebarModel = chosenModel;

            // Remove only selectedProvider key
            chrome.storage.local.remove(['selectedProvider']);
            console.info('[llmStore] Legacy selectedProvider migrated.');
        } catch (error) {
            console.warn('[llmStore] migrateLegacySelectedProvider error:', error);
        }
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

    // 设置特定场景的机器人
    setRobotForType = (type: ConfigModelType, robot: Robot | null) => {
        switch (type) {
            case ConfigModelType.CHAT:
                this.chatRobot = robot;
                break;
            case ConfigModelType.POPUP:
                this.popupRobot = robot;
                break;
            case ConfigModelType.SIDEBAR:
                this.sidebarRobot = robot;
                break;
        }
    };

    // 获取特定场景的机器人
    getRobotForType = (type: ConfigModelType): Robot | null => {
        switch (type) {
            case ConfigModelType.CHAT:
                return this.chatRobot;
            case ConfigModelType.POPUP:
                return this.popupRobot;
            case ConfigModelType.SIDEBAR:
                return this.sidebarRobot;
            default:
                return this.chatRobot;
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
