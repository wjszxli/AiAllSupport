import type { RequestMethod } from '@/typings';

import { CHAT_BOX_ID, CHAT_BUTTON_ID, URL_MAP } from './constant';
import storage from './storage';
import { t } from '@/services/i18n';

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
        throw new Error(t('pleaseSelectProvider'));
    }

    const apiKey = await storage.getApiKey(selectedProvider);
    if (!apiKey && !isLocalhost(selectedProvider)) {
        throw new Error(t('pleaseEnterApiKey'));
    }

    const base_url = URL_MAP[selectedProvider as keyof typeof URL_MAP];
    if (!base_url) {
        throw new Error(t('providerBaseUrlNotFound').replace('{provider}', selectedProvider));
    }

    try {
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

        if (!response.ok) {
            throw new Error(
                t('httpError')
                    .replace('{status}', response.status.toString())
                    .replace('{statusText}', response.statusText)
            );
        }

        if (body && body.includes('"stream":true') && response.body) {
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
            return { status: response.status, ok: response.ok, data };
        }
    } catch (error) {
        console.error('fetchData 错误:', error);
        throw error;
    }
};

export const requestAIStream = async (
    url: string,
    method: RequestMethod = 'GET',
    requestBody: object,
    onData: (chunk: { data: string; done: boolean }) => void,
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
                    onData({ data: `Error: ${msg.response.error || 'Unknown error'}`, done: false });
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
            },
            (response) => {
                console.log('API 响应:', response);
                if (response && response.status === 200) {
                    resolve(response.data);
                } else {
                    const errorMsg = response && response.error ? response.error : 'API request failed';
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
                response: { data: 'Error processing response', ok: false, done: true, error: String(error) },
            });
        }
    }
};
