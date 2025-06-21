import { db } from './index';
import { FILTERED_DOMAINS, SEARCH_ENGINES } from '@/utils/constant';

/**
 * Initialize the database and run any needed migrations
 */
export const initializeDatabase = async () => {
    try {
        // Open the database
        await db.open();
        console.log('Database opened successfully');

        // Check if settings need to be migrated from Chrome storage
        await migrateSettingsFromChromeStorage();

        return true;
    } catch (error) {
        console.error('Failed to initialize database:', error);
        return false;
    }
};

/**
 * Migrate settings from Chrome storage to IndexedDB if needed
 */
async function migrateSettingsFromChromeStorage() {
    try {
        // Check if settings already exist in IndexedDB
        const settingsCount = await db.settings.count();

        if (settingsCount === 0) {
            console.log('Migrating settings from Chrome storage to IndexedDB');

            // Get settings from Chrome storage
            const [
                isChatBoxIcon,
                useWebpageContext,
                webSearchEnabled,
                enabledSearchEngines,
                tavilyApiKey,
                filteredDomains,
            ] = await Promise.all([
                getChromeStorageValue('isIcon', true),
                getChromeStorageValue('useWebpageContext', true),
                getChromeStorageValue('webSearchEnabled', false),
                getChromeStorageValue('enabledSearchEngines', [
                    SEARCH_ENGINES.GOOGLE,
                    SEARCH_ENGINES.BAIDU,
                ]),
                getChromeStorageValue('tavilyApiKey', ''),
                getChromeStorageValue('filteredDomains', FILTERED_DOMAINS),
            ]);

            // Save settings to IndexedDB
            await db.settings.bulkPut([
                { key: 'isChatBoxIcon', value: isChatBoxIcon },
                { key: 'useWebpageContext', value: useWebpageContext },
                { key: 'webSearchEnabled', value: webSearchEnabled },
                { key: 'enabledSearchEngines', value: enabledSearchEngines },
                { key: 'tavilyApiKey', value: tavilyApiKey },
                { key: 'filteredDomains', value: filteredDomains },
            ]);

            console.log('Settings migration completed successfully');
        }
    } catch (error) {
        console.error('Failed to migrate settings:', error);
    }
}

/**
 * Get a value from Chrome storage with a default fallback
 */
async function getChromeStorageValue<T>(key: string, defaultValue: T): Promise<T> {
    try {
        return await new Promise<T>((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key] !== undefined ? result[key] : defaultValue);
            });
        });
    } catch (error) {
        console.error(`Failed to get ${key} from Chrome storage:`, error);
        return defaultValue;
    }
}

export default initializeDatabase;
