import type { RequestMethod, WebsiteMetadata } from '@/typings';

import { CHAT_BOX_ID, CHAT_BUTTON_ID, URL_MAP } from './constant';
import storage from './storage';
import { t } from '@/services/i18n';
import { Logger } from './logger';
export * from './logger';

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

    const { selectedProvider } = await storage.getConfig();
    if (!selectedProvider) {
        logger.error('No provider selected');
        throw new Error(t('pleaseSelectProvider'));
    }

    const apiKey = await storage.getApiKey(selectedProvider);
    if (!apiKey && !isLocalhost(selectedProvider)) {
        logger.error('No API key provided for non-localhost provider', {
            provider: selectedProvider,
        });
        throw new Error(t('pleaseEnterApiKey'));
    }

    const base_url = URL_MAP[selectedProvider as keyof typeof URL_MAP];
    if (!base_url) {
        logger.error('Base URL not found for provider', { provider: selectedProvider });
        throw new Error(t('providerBaseUrlNotFound').replace('{provider}', selectedProvider));
    }

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

        if (isLocalhost(selectedProvider)) {
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
                    console.error('Stream response error:', msg.response.error);
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
                console.log('API 响应:', response);
                if (response && response.status === 200) {
                    resolve(response.data);
                } else {
                    const errorMsg =
                        response && response.error ? response.error : 'API request failed';
                    console.error('API 请求失败:', errorMsg);
                    // Send error as a data message to be displayed to the user
                    onData({ data: `Error: ${errorMsg}`, done: false });
                    reject(errorMsg);
                }
            },
        );

        window.currentAbortController.signal.addEventListener('abort', () => {
            console.log('🚫 中止请求.......');
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
                console.log('API 响应:', response);
                if (response.status === 200) {
                    resolve(response.data);
                } else {
                    console.error('API 请求失败:', response.error);
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

export const isLocalhost = (selectedProvider: string | null) => {
    return selectedProvider === 'Ollama';
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
        console.error('Error handling message:', error);
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
                                contentText += `${(element as HTMLElement).innerText}\n\n`;
                            });
                        } else {
                            contentText = document.body.innerText;
                        }

                        return contentText;
                    };

                    const content = extractContent();
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
        console.error('Error extracting website metadata:', error);
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
