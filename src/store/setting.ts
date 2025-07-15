import { makeAutoObservable } from 'mobx';
import { FILTERED_DOMAINS, SEARCH_ENGINES } from '@/utils/constant';

// 延迟创建Logger实例，避免循环依赖
let logger: any = {
    info: (msg: string, ...args: any[]) => console.log(`[settingStore] ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => console.error(`[settingStore] ${msg}`, ...args),
    warn: (msg: string, ...args: any[]) => console.warn(`[settingStore] ${msg}`, ...args),
    debug: (msg: string, ...args: any[]) => console.debug(`[settingStore] ${msg}`, ...args),
};

// 异步初始化真正的Logger
(async () => {
    try {
        const { Logger } = await import('@/utils/logger');
        logger = new Logger('settingStore');
    } catch (error) {
        console.error('Failed to initialize logger in settingStore:', error);
    }
})();

export interface SettingsState {
    // Interface settings
    isChatBoxIcon: boolean;
    useWebpageContext: boolean;

    // Search settings
    webSearchEnabled: boolean;
    enabledSearchEngines: string[];
    tavilyApiKey: string;
    exaApiKey: string;
    bochaApiKey: string;
    searxngApiUrl: string;
    searxngUsername: string;
    filteredDomains: string[];
}

// Setting keys for Chrome storage
const IS_CHAT_BOX_ICON_KEY = 'settings.isChatBoxIcon';
const USE_WEBPAGE_CONTEXT_KEY = 'settings.useWebpageContext';
const WEB_SEARCH_ENABLED_KEY = 'settings.webSearchEnabled';
const ENABLED_SEARCH_ENGINES_KEY = 'settings.enabledSearchEngines';
const TAVILY_API_KEY = 'settings.tavilyApiKey';
const EXA_API_KEY = 'settings.exaApiKey';
const BOCHA_API_KEY = 'settings.bochaApiKey';
const SEARXNG_API_URL_KEY = 'settings.searxngApiUrl';
const SEARXNG_USERNAME_KEY = 'settings.searxngUsername';
const FILTERED_DOMAINS_KEY = 'settings.filteredDomains';

class SettingStore {
    // Interface settings
    isChatBoxIcon = true;
    useWebpageContext = true;

    // Search settings
    webSearchEnabled = false;
    enabledSearchEngines: string[] = [];
    tavilyApiKey = '';
    exaApiKey = '';
    bochaApiKey = '';
    searxngApiUrl = '';
    searxngUsername = '';
    filteredDomains: string[] = [];

    // Callback system for tool refresh
    private toolRefreshCallbacks: (() => void)[] = [];

    constructor() {
        makeAutoObservable(this);
        this.loadSettings();
    }

    /**
     * Register a callback to be called when search/tool settings change
     */
    public registerToolRefreshCallback(callback: () => void) {
        this.toolRefreshCallbacks.push(callback);
        logger.info('Tool refresh callback registered');
    }

    /**
     * Unregister a tool refresh callback
     */
    public unregisterToolRefreshCallback(callback: () => void) {
        const index = this.toolRefreshCallbacks.indexOf(callback);
        if (index > -1) {
            this.toolRefreshCallbacks.splice(index, 1);
            logger.info('Tool refresh callback unregistered');
        }
    }

    /**
     * Notify all registered callbacks that tool settings have changed
     */
    private notifyToolRefreshCallbacks() {
        logger.info(`Notifying ${this.toolRefreshCallbacks.length} tool refresh callbacks`);
        this.toolRefreshCallbacks.forEach((callback) => {
            try {
                callback();
            } catch (error) {
                logger.error('Error in tool refresh callback:', error);
            }
        });
    }

    private async getChromeStorageValue<T>(key: string, defaultValue: T): Promise<T> {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key] !== undefined ? result[key] : defaultValue);
            });
        });
    }

    private async setChromeStorageValue(key: string, value: any): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, () => resolve());
        });
    }

    async loadSettings() {
        try {
            // Load individual settings from Chrome storage
            const [
                isChatBoxIcon,
                useWebpageContext,
                webSearchEnabled,
                enabledSearchEngines,
                tavilyApiKey,
                exaApiKey,
                bochaApiKey,
                searxngApiUrl,
                searxngUsername,
                filteredDomains,
            ] = await Promise.all([
                this.getChromeStorageValue(IS_CHAT_BOX_ICON_KEY, true),
                this.getChromeStorageValue(USE_WEBPAGE_CONTEXT_KEY, true),
                this.getChromeStorageValue(WEB_SEARCH_ENABLED_KEY, false),
                this.getChromeStorageValue(ENABLED_SEARCH_ENGINES_KEY, [
                    SEARCH_ENGINES.GOOGLE,
                    SEARCH_ENGINES.BAIDU,
                ]),
                this.getChromeStorageValue(TAVILY_API_KEY, ''),
                this.getChromeStorageValue(EXA_API_KEY, ''),
                this.getChromeStorageValue(BOCHA_API_KEY, ''),
                this.getChromeStorageValue(SEARXNG_API_URL_KEY, ''),
                this.getChromeStorageValue(SEARXNG_USERNAME_KEY, ''),
                this.getChromeStorageValue(FILTERED_DOMAINS_KEY, FILTERED_DOMAINS),
            ]);

            // Apply settings
            this.isChatBoxIcon = isChatBoxIcon;
            this.useWebpageContext = useWebpageContext;
            this.webSearchEnabled = webSearchEnabled;
            if (Object.keys(enabledSearchEngines).length > 0) {
                this.enabledSearchEngines = Object.keys(enabledSearchEngines).map(
                    // @ts-ignore
                    (key) => enabledSearchEngines[key],
                );
            }

            this.tavilyApiKey = tavilyApiKey;
            this.exaApiKey = exaApiKey;
            this.bochaApiKey = bochaApiKey;
            this.searxngApiUrl = searxngApiUrl;
            this.searxngUsername = searxngUsername;
            if (Object.keys(filteredDomains).length > 0) {
                this.filteredDomains = Object.keys(filteredDomains).map(
                    // @ts-ignore
                    (key) => filteredDomains[key],
                );
            }

            logger.info('Settings loaded successfully from Chrome storage');
        } catch (error) {
            logger.error('Failed to load settings:', error);
            // Save default settings if loading fails
            this.saveSettings();
        }
    }

    async saveSettings() {
        try {
            // Save each setting individually to Chrome storage
            await Promise.all([
                this.setChromeStorageValue(IS_CHAT_BOX_ICON_KEY, this.isChatBoxIcon),
                this.setChromeStorageValue(USE_WEBPAGE_CONTEXT_KEY, this.useWebpageContext),
                this.setChromeStorageValue(WEB_SEARCH_ENABLED_KEY, this.webSearchEnabled),
                this.setChromeStorageValue(ENABLED_SEARCH_ENGINES_KEY, this.enabledSearchEngines),
                this.setChromeStorageValue(TAVILY_API_KEY, this.tavilyApiKey),
                this.setChromeStorageValue(EXA_API_KEY, this.exaApiKey),
                this.setChromeStorageValue(BOCHA_API_KEY, this.bochaApiKey),
                this.setChromeStorageValue(SEARXNG_API_URL_KEY, this.searxngApiUrl),
                this.setChromeStorageValue(SEARXNG_USERNAME_KEY, this.searxngUsername),
                this.setChromeStorageValue(FILTERED_DOMAINS_KEY, this.filteredDomains),
            ]);

            logger.info('Settings saved successfully to Chrome storage');
        } catch (error) {
            logger.error('Failed to save settings:', error);
        }
    }

    // Get all settings as an object
    getAllSettings(): SettingsState {
        return {
            isChatBoxIcon: this.isChatBoxIcon,
            useWebpageContext: this.useWebpageContext,
            webSearchEnabled: this.webSearchEnabled,
            enabledSearchEngines: this.enabledSearchEngines,
            tavilyApiKey: this.tavilyApiKey,
            exaApiKey: this.exaApiKey,
            bochaApiKey: this.bochaApiKey,
            searxngApiUrl: this.searxngApiUrl,
            searxngUsername: this.searxngUsername,
            filteredDomains: this.filteredDomains,
        };
    }

    // Import settings from an object
    async importSettings(settings: Partial<SettingsState>) {
        // Update only the settings that are provided
        if (settings.isChatBoxIcon !== undefined) this.isChatBoxIcon = settings.isChatBoxIcon;
        if (settings.useWebpageContext !== undefined)
            this.useWebpageContext = settings.useWebpageContext;
        if (settings.webSearchEnabled !== undefined)
            this.webSearchEnabled = settings.webSearchEnabled;
        if (settings.enabledSearchEngines !== undefined)
            this.enabledSearchEngines = settings.enabledSearchEngines;
        if (settings.tavilyApiKey !== undefined) this.tavilyApiKey = settings.tavilyApiKey;
        if (settings.exaApiKey !== undefined) this.exaApiKey = settings.exaApiKey;
        if (settings.bochaApiKey !== undefined) this.bochaApiKey = settings.bochaApiKey;
        if (settings.filteredDomains !== undefined) this.filteredDomains = settings.filteredDomains;

        // Save the imported settings
        await this.saveSettings();

        logger.info('Settings imported successfully');
    }

    // Interface settings methods
    setIsChatBoxIcon(value: boolean) {
        this.isChatBoxIcon = value;
        this.saveSettings();
    }

    setUseWebpageContext(value: boolean) {
        this.useWebpageContext = value;
        this.saveSettings();
        this.notifyToolRefreshCallbacks();
    }

    // Search settings methods
    setWebSearchEnabled(value: boolean) {
        this.webSearchEnabled = value;
        this.saveSettings();
        this.notifyToolRefreshCallbacks();
    }

    setEnabledSearchEngines(engines: string[]) {
        this.enabledSearchEngines = engines;
        this.saveSettings();
        this.notifyToolRefreshCallbacks();
    }

    setTavilyApiKey(key: string) {
        this.tavilyApiKey = key;
        this.saveSettings();
        this.notifyToolRefreshCallbacks();
    }

    setExaApiKey(key: string) {
        this.exaApiKey = key;
        this.saveSettings();
        this.notifyToolRefreshCallbacks();
    }

    setBochaApiKey(key: string) {
        this.bochaApiKey = key;
        this.saveSettings();
        this.notifyToolRefreshCallbacks();
    }

    setSearxngApiUrl(url: string) {
        this.searxngApiUrl = url;
        this.saveSettings();
    }

    setSearxngUsername(username: string) {
        this.searxngUsername = username;
        this.saveSettings();
    }

    setFilteredDomains(domains: string[]) {
        this.filteredDomains = domains;
        this.saveSettings();
    }

    addFilteredDomain(domain: string) {
        if (!this.filteredDomains.includes(domain)) {
            this.filteredDomains.push(domain);
            this.saveSettings();
        }
    }

    removeFilteredDomain(domain: string) {
        this.filteredDomains = this.filteredDomains.filter((d) => d !== domain);
        this.saveSettings();
    }
}

const settingStore = new SettingStore();

export default settingStore;
