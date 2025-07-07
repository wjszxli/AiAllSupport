import type { Model, Provider, WebsiteMetadata , ConfigModelType } from '@/types';
import llmStore from '@/store/llm';

import { CHAT_BOX_ID, CHAT_BUTTON_ID, PROVIDERS_DATA, FLOATING_CHAT_BUTTON_ID } from './constant';
import { Logger } from './logger';
import storage from './storage';

export * from './logger';
export * from './i18n';

// Create a logger for this module
const logger = new Logger('utils');

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
