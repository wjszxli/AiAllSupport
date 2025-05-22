type StorageKey = string | string[] | Record<string, any> | null;
type StorageResult<T> = T extends string
    ? any
    : T extends string[]
    ? any[]
    : T extends Record<string, any>
    ? Record<string, any>
    : null;

const chromeStorageAdapter = {
    getItem: async <T extends StorageKey>(key: T): Promise<StorageResult<T>> => {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get(key, (result) => {
                    if (typeof key === 'string') {
                        resolve(result[key] || null);
                    } else if (Array.isArray(key)) {
                        resolve(key.map((k) => result[k] || null) as StorageResult<T>);
                    } else if (key && typeof key === 'object') {
                        resolve(
                            Object.keys(key).reduce<Record<string, any>>((acc, k) => {
                                acc[k] = result[k] || null;
                                return acc;
                            }, {}) as StorageResult<T>,
                        );
                    } else {
                        resolve(null as StorageResult<T>);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    },
    setItem: async <T extends StorageKey>(key: T, value: any): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            try {
                if (typeof key === 'string') {
                    chrome.storage.local.set({ [key]: value }, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                            return;
                        }
                        resolve();
                    });
                } else if (Array.isArray(key)) {
                    const stringKeys = key as string[];
                    const data = stringKeys.reduce<Record<string, any>>(
                        (acc: Record<string, any>, k: string) => ({ ...acc, [k]: value }),
                        {},
                    );
                    chrome.storage.local.set(data, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                            return;
                        }
                        resolve();
                    });
                } else if (key && typeof key === 'object') {
                    chrome.storage.local.set(key, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                            return;
                        }
                        resolve();
                    });
                } else {
                    resolve();
                }
            } catch (error) {
                reject(error);
            }
        });
    },
    removeItem: async (key: StorageKey): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            try {
                if (typeof key === 'string' || Array.isArray(key)) {
                    chrome.storage.local.remove(key, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                            return;
                        }
                        resolve();
                    });
                } else if (key && typeof key === 'object') {
                    chrome.storage.local.remove(Object.keys(key), () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                            return;
                        }
                        resolve();
                    });
                } else {
                    resolve();
                }
            } catch (error) {
                reject(error);
            }
        });
    },
};

export default chromeStorageAdapter;
