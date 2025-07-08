import { makeAutoObservable } from 'mobx';
import { FILTERED_DOMAINS, SEARCH_ENGINES } from '@/utils/constant';
import { Logger } from '@/utils/logger';

const logger = new Logger('settingStore');

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
    filteredDomains: string[] = [];

    constructor() {
        makeAutoObservable(this);
        this.loadSettings();
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
    }

    // Search settings methods
    setWebSearchEnabled(value: boolean) {
        this.webSearchEnabled = value;
        this.saveSettings();
    }

    setEnabledSearchEngines(engines: string[]) {
        this.enabledSearchEngines = engines;
        this.saveSettings();
    }

    setTavilyApiKey(key: string) {
        this.tavilyApiKey = key;
        this.saveSettings();
    }

    setExaApiKey(key: string) {
        this.exaApiKey = key;
        this.saveSettings();
    }

    setBochaApiKey(key: string) {
        this.bochaApiKey = key;
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
