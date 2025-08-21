import { t } from '@/locales/i18n';
import type { ProviderConfig, StorageData } from '@/types';
import type { SettingsState } from '@/store/setting';
import settingStore from '@/store/setting';

import { PROVIDERS_DATA } from './constant';

// 封装存储 & 读取 & 监听变化的方法
const storageUtils = {
    //  存储数据
    set: (key: string, value: any): Promise<void> => {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, () => resolve());
        });
    },
    remove: (key: string): Promise<void> => {
        return new Promise((resolve) => {
            chrome.storage.local.remove([key], () => resolve());
        });
    },
    //  读取数据
    get: <T>(key: string): Promise<T | null> => {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key] || null);
            });
        });
    },

    //  监听数据变化
    onChanged: (callback: (changes: Record<string, chrome.storage.StorageChange>) => void) => {
        chrome.storage.onChanged.addListener(callback);
    },

    //  获取完整配置
    getConfig: async (): Promise<StorageData> => {
        const providers =
            (await storageUtils.get<Record<string, ProviderConfig>>('providers')) || {};
        const selectedProvider = await storageUtils.get<string>('selectedProvider');
        let selectedModel = await storageUtils.get<string>('selectedModel');

        if (selectedProvider) {
            selectedModel =
                providers[selectedProvider]?.selectedModel ||
                providers[selectedProvider]?.models[0].value;
        }

        return { providers, selectedProvider, selectedModel };
    },
    //  获取指定服务商的 API Key
    getApiKey: async (provider: string): Promise<string | null> => {
        const providers =
            (await storageUtils.get<Record<string, ProviderConfig>>('providers')) || {};
        return providers[provider]?.apiKey ?? null;
    },

    //  存储完整的 providers 数据
    setProviders: async (providers: Record<string, ProviderConfig>): Promise<void> => {
        await storageUtils.set('providers', providers);
    },

    //  获取完整的 providers 数据
    getProviders: async (): Promise<Record<string, ProviderConfig>> => {
        return (await storageUtils.get<Record<string, ProviderConfig>>('providers')) || {};
    },

    //  更新某个服务商的 API Key
    updateApiKey: async (provider: string, apiKey: string): Promise<void> => {
        const data =
            (await storageUtils.get<Record<string, ProviderConfig>>('providers')) || PROVIDERS_DATA;
        if (!data[provider]) {
            throw new Error(t('invalidProviderData').replace('{provider}', provider));
        }

        data[provider].apiKey = apiKey;

        await storageUtils.set('providers', data);
    },

    //  设置当前选中的服务商
    setSelectedProvider: async (provider: string): Promise<void> => {
        await storageUtils.set('selectedProvider', provider);
    },

    //  获取当前选中的服务商
    getSelectedProvider: async (): Promise<string> => {
        return (await storageUtils.get<string>('selectedProvider')) || 'DeepSeek';
    },

    //  设置当前选中的模型
    setSelectedModel: async (model: string): Promise<void> => {
        const selectedProvider = await storageUtils.getSelectedProvider();
        let providers = await storageUtils.getProviders();
        if (!providers) {
            providers = PROVIDERS_DATA;
        }

        providers[selectedProvider].selectedModel = model;
        await storageUtils.setProviders(providers);
    },

    setChatBoxSize: async ({ width, height }: { width: number; height: number }): Promise<void> => {
        await storageUtils.set('height', height);
        await storageUtils.set('width', width);
    },
    getChatBoxSize: async () => {
        const width = (await storageUtils.get<number>('width')) || 500;
        const height = (await storageUtils.get<number>('height')) || 500;
        return { width, height };
    },

    // Settings-related methods now use settingStore
    setIsChatBoxIcon: async (isIcon: boolean): Promise<void> => {
        await settingStore.waitForLoad();
        settingStore.setIsChatBoxIcon(isIcon);
    },
    getIsChatBoxIcon: async () => {
        await settingStore.waitForLoad();
        return settingStore.isChatBoxIcon;
    },

    setShowFloatingButton: async (enabled: boolean): Promise<void> => {
        await settingStore.waitForLoad();
        settingStore.setShowFloatingButton(enabled);
    },
    getShowFloatingButton: async () => {
        await settingStore.waitForLoad();
        return settingStore.showFloatingButton;
    },

    getLocale: async (): Promise<string | null> => {
        try {
            const result = await chrome.storage.local.get('locale');
            return result.locale || null;
        } catch (error) {
            console.error('Failed to get locale:', error);
            return null;
        }
    },

    setLocale: async (locale: string): Promise<void> => {
        try {
            await chrome.storage.local.set({ locale });
            window.dispatchEvent(new CustomEvent('localeChange', { detail: { locale } }));
        } catch (error) {
            console.error('Failed to set locale:', error);
        }
    },

    setWebSearchEnabled: async (enabled: boolean): Promise<void> => {
        await settingStore.waitForLoad();
        settingStore.setWebSearchEnabled(enabled);
    },

    getWebSearchEnabled: async (): Promise<boolean> => {
        await settingStore.waitForLoad();
        return settingStore.webSearchEnabled;
    },

    setUseWebpageContext: async (enabled: boolean): Promise<void> => {
        await settingStore.waitForLoad();
        settingStore.setUseWebpageContext(enabled);
    },

    getUseWebpageContext: async (): Promise<boolean> => {
        await settingStore.waitForLoad();
        return settingStore.useWebpageContext;
    },

    // 获取启用的搜索引擎列表
    getEnabledSearchEngines: async (): Promise<string[]> => {
        await settingStore.waitForLoad();
        return settingStore.enabledSearchEngines;
    },

    // 设置启用的搜索引擎列表
    setEnabledSearchEngines: async (engines: string[]): Promise<void> => {
        await settingStore.waitForLoad();
        settingStore.setEnabledSearchEngines(engines);
    },

    // 获取Tavily API密钥
    getTavilyApiKey: async (): Promise<string | null> => {
        return settingStore.tavilyApiKey || null;
    },

    // 设置Tavily API密钥
    setTavilyApiKey: async (apiKey: string): Promise<void> => {
        settingStore.setTavilyApiKey(apiKey);
    },

    // 获取搜索过滤的域名列表
    getFilteredDomains: async (): Promise<string[]> => {
        return settingStore.filteredDomains;
    },

    // 设置搜索过滤的域名列表
    setFilteredDomains: async (domains: string[]): Promise<void> => {
        settingStore.setFilteredDomains(domains);
    },

    // Get all settings at once
    getAllSettings: async (): Promise<SettingsState> => {
        return settingStore.getAllSettings();
    },

    // Set all settings at once
    setAllSettings: async (settings: Partial<SettingsState>): Promise<void> => {
        await settingStore.importSettings(settings);
    },
};

export default storageUtils;
