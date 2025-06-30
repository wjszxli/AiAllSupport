import { t } from '@/locales/i18n';
import type { Model, Provider, RequestMethod, WebsiteMetadata } from '@/types';
import { ConfigModelType } from '@/types';
import llmStore from '@/store/llm';

import { CHAT_BOX_ID, CHAT_BUTTON_ID, PROVIDERS_DATA, FLOATING_CHAT_BUTTON_ID } from './constant';
import { Logger } from './logger';
import storage from './storage';

export * from './logger';
export * from './i18n';

// Create a logger for this module
const logger = new Logger('utils');

// 通用 Fetch 封装，支持流式响应
export const fetchData = async ({
    url,
    method = 'POST',
    body,
    headers = {},
    timeout = 100000,
    onStream,
    controller,
}: {
    url: string;
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    timeout?: number;
    onStream?: (chunk: string) => void;
    controller: AbortController;
}): Promise<{ status: number; ok: boolean; data: any }> => {
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const { selectedProvider, providers } = await storage.getConfig();
    if (!selectedProvider) {
        logger.error('No provider selected');
        throw new Error(t('pleaseSelectProvider'));
    }

    const apiKey = await storage.getApiKey(selectedProvider);

    if (!apiKey && requiresApiKey(selectedProvider, providers)) {
        logger.error('No API key provided for provider that requires it', {
            provider: selectedProvider,
        });
        throw new Error(t('pleaseEnterApiKey'));
    }

    let base_url = providers[selectedProvider]?.apiHost;
    if (!base_url) {
        base_url = PROVIDERS_DATA[selectedProvider].apiHost;
    }
    logger.debug('Base URL', { base_url });

    try {
        logger.debug('Preparing fetch request', { url: base_url + url, method });

        const config: RequestInit = {
            method,
            body,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                ...headers,
            },
            signal: controller.signal,
        };

        if (!requiresApiKey(selectedProvider, providers)) {
            delete (config.headers as Record<string, string>).Authorization;
        }

        if (method === 'GET' || method === 'HEAD') {
            delete config.body;
        }

        const response = await fetch(base_url + url, config);

        clearTimeout(timeoutId);

        logger.debug('Fetch response received', { status: response.status, ok: response.ok });

        if (!response.ok) {
            const errorMsg = t('httpError')
                .replace('{status}', response.status.toString())
                .replace('{statusText}', response.statusText);
            logger.error('Fetch error', {
                status: response.status,
                statusText: response.statusText,
            });
            throw new Error(errorMsg);
        }

        if (body && body.includes('"stream":true') && response.body) {
            logger.debug('Processing stream response');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                onStream?.(chunk);
            }
            return { status: response.status, ok: response.ok, data: {} };
        } else {
            const data = await response.json();
            logger.debug('Processed JSON response');
            return { status: response.status, ok: response.ok, data };
        }
    } catch (error: unknown) {
        logger.error('Fetch error', { error });
        throw error;
    }
};

export const requestAIStream = async (
    url: string,
    method: RequestMethod = 'GET',
    requestBody: object,
    onData: (chunk: { data: string; done: boolean }) => void,
    tabId?: string | null,
) => {
    return new Promise<void>((resolve, reject) => {
        const listener = (msg: any) => {
            if (msg.type === 'streamResponse') {
                if (msg.response.done) {
                    // 发送最后一次数据
                    onData(msg.response);
                    chrome.runtime.onMessage.removeListener(listener);
                    resolve();
                } else if (msg.response.ok) {
                    onData(msg.response);
                } else {
                    // Properly handle and log errors
                    logger.error('Stream response error:', { error: msg.response.error });
                    onData({
                        data: `Error: ${msg.response.error || 'Unknown error'}`,
                        done: false,
                    });
                    reject(new Error(msg.response.error || 'Unknown error'));
                }
            }
        };

        chrome.runtime.onMessage.addListener(listener);

        const controller = new AbortController();
        // @ts-ignore
        window.currentAbortController = controller;
        // @ts-ignore
        window.currentAbortController.signal.addEventListener('abort', () => {
            chrome.runtime.sendMessage({ action: 'abortRequest' });
        });

        chrome.runtime.sendMessage(
            {
                action: 'fetchData',
                url,
                method,
                body: JSON.stringify({ ...requestBody, stream: true }), // 启用流式模式
                tabId,
            },
            (response) => {
                logger.info('API response:', { response });
                if (response && response.status === 200) {
                    resolve(response.data);
                } else {
                    const errorMsg =
                        response && response.error ? response.error : 'API request failed';
                    logger.error('API request failed:', { error: errorMsg });
                    // Send error as a data message to be displayed to the user
                    onData({ data: `Error: ${errorMsg}`, done: false });
                    reject(errorMsg);
                }
            },
        );

        window.currentAbortController.signal.addEventListener('abort', () => {
            logger.info('🚫 Aborting request...');
            onData({ data: '', done: true });
            chrome.runtime.onMessage.removeListener(listener);
            resolve();
        });
    });
};

export const requestApi = (url: string, method: RequestMethod = 'GET', requestBody?: any) => {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            {
                action: 'fetchData',
                url,
                method,
                body: JSON.stringify({ ...requestBody, stream: false }),
            },
            (response) => {
                logger.info('API response:', { response });
                if (response.status === 200) {
                    resolve(response.data);
                } else {
                    logger.error('API request failed:', { error: response.error });
                    reject(response.error);
                }
            },
        );
    });
};

// 移除按钮
export const removeChatButton = async () => {
    const chatButton = document.getElementById(CHAT_BUTTON_ID);
    if (chatButton) chatButton.remove();
};

export const removeChatBox = async () => {
    const chatBox = document.getElementById(CHAT_BOX_ID);
    if (chatBox) chatBox.remove();
    await storage.remove('chatHistory');
    // @ts-ignore
    if (window.currentAbortController) {
        // @ts-ignore
        window.currentAbortController.abort();
        // @ts-expect-error
        window.currentAbortController = null;
    }
};

export const removeFloatingChatButton = async () => {
    const floatingButton = document.getElementById(FLOATING_CHAT_BUTTON_ID);
    if (floatingButton) floatingButton.remove();
};

export const handleMessage = (message: string, sender: { tab: { id: number } }) => {
    try {
        const lines = message.split('\n');

        for (const line of lines) {
            if (line.trim() === '' || !line.startsWith('data: ')) continue;

            const data = line.slice(6);
            if (sender?.tab?.id) {
                if (data === '[DONE]') {
                    chrome.tabs.sendMessage(sender.tab.id, {
                        type: 'streamResponse',
                        response: { data: '', ok: true, done: true },
                    });
                    break;
                } else {
                    chrome.tabs.sendMessage(sender.tab.id, {
                        type: 'streamResponse',
                        response: { data: line, ok: true, done: false },
                    });
                }
            }
        }
    } catch (error) {
        logger.error('Error handling message:', { error });
        if (sender?.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
                type: 'streamResponse',
                response: {
                    data: 'Error processing response',
                    ok: false,
                    done: true,
                    error: String(error),
                },
            });
        }
    }
};

/**
 * Extract website metadata from the current page
 * @returns Promise resolving to website metadata
 */
export async function extractWebsiteMetadata(): Promise<WebsiteMetadata> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
            throw new Error('No active tab found');
        }

        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                try {
                    const extractContent = () => {
                        const mainElements = document.querySelectorAll(
                            'main, article, [role="main"]',
                        );
                        let contentText = '';

                        if (mainElements.length > 0) {
                            mainElements.forEach((element) => {
                                contentText += `${(element as HTMLElement).textContent}`;
                            });
                        } else {
                            contentText = document.body.textContent || '';
                        }

                        return contentText;
                    };

                    const content = extractContent().replace(/\n/g, '');
                    const language = navigator.language || 'en-US';

                    return {
                        url: document.location.href,
                        origin: document.location.origin,
                        title: document.title,
                        content: content.slice(0, 15000),
                        type: 'html',
                        selection: window.getSelection()?.toString() || '',
                        language: language,
                    };
                } catch (error) {
                    // We can't use our logger here because this code runs in the browser context
                    console.error('Error extracting webpage content:', error);
                    return {
                        url: document.location.href,
                        origin: document.location.origin,
                        title: document.title || 'Unknown page',
                        content: 'Failed to extract page content',
                        type: 'html',
                        selection: '',
                        hash: '0',
                    };
                }
            },
        });

        if (!result || !result[0] || !result[0].result) {
            throw new Error('Failed to extract webpage content');
        }

        const extractedData = result[0].result;
        const language = extractedData.language || 'en';

        return {
            system: {
                language: language,
            },
            website: extractedData,
            id: tab.id.toString(),
        };
    } catch (error) {
        logger.error('Error extracting website metadata:', { error });
        return {
            system: {
                language: 'en',
            },
            website: {
                url: 'about:blank',
                origin: 'about:blank',
                title: 'Unknown page',
                content: 'Failed to extract page content',
                type: 'html',
                selection: '',
            },
            id: '0',
        };
    }
}

export function formatApiHost(host: string) {
    const forceUseOriginalHost = () => {
        if (host.endsWith('/')) {
            return true;
        }

        return host.endsWith('volces.com/api/v3');
    };

    return forceUseOriginalHost() ? host : `${host}/v1/`;
}

export const getDefaultGroupName = (id: string, provider?: string) => {
    const str = id.toLowerCase();

    // 定义分隔符
    let firstDelimiters = ['/', ' ', ':'];
    let secondDelimiters = ['-', '_'];

    if (
        provider &&
        ['aihubmix', 'silicon', 'ocoolai', 'o3', 'dmxapi'].includes(provider.toLowerCase())
    ) {
        firstDelimiters = ['/', ' ', '-', '_', ':'];
        secondDelimiters = [];
    }

    // 第一类分隔规则
    for (const delimiter of firstDelimiters) {
        if (str.includes(delimiter)) {
            return str.split(delimiter)[0];
        }
    }

    // 第二类分隔规则
    for (const delimiter of secondDelimiters) {
        if (str.includes(delimiter)) {
            const parts = str.split(delimiter);
            return parts.length > 1 ? parts[0] + '-' + parts[1] : parts[0];
        }
    }

    return str;
};

export const getModelGroupOptions = (models: Model[] = []) => {
    const groupMap: Record<string, any[]> = {};
    models.forEach((model) => {
        const group = model.group || 'Other';
        if (!groupMap[group]) groupMap[group] = [];
        groupMap[group].push({ label: model.name, value: model.id });
    });

    const sortedGroups = Object.keys(groupMap).sort((a, b) => {
        const aFree = a.includes('Free');
        const bFree = b.includes('Free');
        if (aFree && !bFree) return -1;
        if (!aFree && bFree) return 1;
        return a.localeCompare(b);
    });

    return sortedGroups.map((group) => ({
        label: group,
        options: groupMap[group],
    }));
};

/**
 * 获取特定界面类型的模型
 *
 * 根据界面类型（聊天、弹窗、侧边栏）获取相应的模型。
 * 如果特定界面类型没有设置模型，会按照以下顺序回退：
 * 1. 指定界面类型的模型
 * 2. 聊天界面的模型
 * 3. 默认模型
 *
 * @example
 * // 在聊天界面获取模型
 * const chatModel = getModelForInterface(ConfigModelType.CHAT);
 *
 * // 在弹窗界面获取模型
 * const popupModel = getModelForInterface(ConfigModelType.POPUP);
 *
 * @param type 界面类型
 * @returns 对应界面类型的模型
 */
export function getModelForInterface(type: ConfigModelType) {
    return llmStore.getModelForType(type);
}

/**
 * Navigate to settings page
 * Handles both Chrome extension and web environments
 */
export const navigateToSettings = () => {
    try {
        // 检查是否在 Chrome 扩展环境中
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            // 在扩展环境中，打开设置页面
            chrome.tabs
                .create({
                    url: chrome.runtime.getURL('options.html'),
                })
                .catch((error) => {
                    console.error('Failed to open settings page:', error);
                    // 如果创建新标签页失败，尝试在当前页面打开
                    if (window && window.open) {
                        window.open(chrome.runtime.getURL('options.html'), '_blank');
                    }
                });
        } else if (typeof window !== 'undefined') {
            // 在网页环境中，尝试导航到设置页面
            if (window.location.hash) {
                window.location.hash = '#/settings';
            } else {
                const settingsUrl = chrome?.runtime?.getURL?.('options.html') || '/options.html';
                window.location.href = settingsUrl;
            }
        }
    } catch (error) {
        console.error('Failed to navigate to settings:', error);
    }
};

/**
 * 判断指定的 provider 是否需要 API Key
 * @param provider Provider对象或provider ID字符串
 * @param providers 可选的providers配置对象
 * @returns boolean 是否需要API Key
 */
export const requiresApiKey = (
    provider: Provider | string,
    providers?: Record<string, any>,
): boolean => {
    let providerConfig: any;

    if (typeof provider === 'string') {
        // 如果传入的是字符串ID，从配置中查找
        providerConfig = providers?.[provider] || PROVIDERS_DATA[provider];
    } else {
        // 如果传入的是Provider对象，直接使用
        providerConfig = provider;
    }

    // 默认需要API Key，除非明确设置为false
    return providerConfig?.requiresApiKey !== false;
};
