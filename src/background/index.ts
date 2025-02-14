import { OllamaResponse } from '@/typings';
import { fetchData, handleMessage, isLocalhost } from '@/utils';
import { MODIFY_HEADERS_RULE_ID, URL_MAP } from '@/utils/constant';
import storage from '@/utils/storage';

// chrome.runtime.onInstalled.addListener((details) => {
//     if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
//         // 打开说明页面
//         chrome.tabs.create({
//             url: chrome.runtime.getURL('/Instructions.html'),
//         });
//     }
// });

console.log('chrome.declarativeNetRequest', chrome.runtime);
chrome.declarativeNetRequest.updateDynamicRules(
    {
        addRules: [
            {
                id: MODIFY_HEADERS_RULE_ID, // 规则 ID
                priority: 1,
                action: {
                    // @ts-ignore
                    type: 'modifyHeaders',
                    // @ts-ignore
                    requestHeaders: [
                        // @ts-ignore
                        { header: 'Origin', operation: 'set', value: URL_MAP.Ollama },
                    ],
                },
                condition: {
                    urlFilter: `${URL_MAP.Ollama}/*`,
                    // @ts-ignore
                    resourceTypes: ['xmlhttprequest'],
                },
            },
        ],
        removeRuleIds: [MODIFY_HEADERS_RULE_ID], // 先删除旧规则，防止重复
    },
    () => {
        if (chrome.runtime.lastError) {
            console.error('更新规则失败:', chrome.runtime.lastError);
        } else {
            console.log('规则更新成功！');
        }
    },
);

const requestControllers = new Map();

// 监听 `popup.ts` 或 `content.ts` 发送的消息，并代理 API 请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchData') {
        const controller = new AbortController();

        if (sender?.tab?.id) {
            requestControllers.set(sender.tab.id, controller);
        }

        console.log('📡 发送请求:', request.body);

        fetchData({
            url: request.url,
            method: request.method,
            headers: request.headers,
            body: request.body,
            onStream: (chunk) => {
                console.log('chunk', chunk);
                storage.getConfig().then((config) => {
                    const { selectedProvider } = config;
                    if (isLocalhost(selectedProvider)) {
                        const data: OllamaResponse = JSON.parse(chunk);
                        const {
                            message: { content },
                            done,
                        } = data;
                        if (done && sender?.tab?.id) {
                            chrome.tabs.sendMessage(sender.tab.id, {
                                type: 'streamResponse',
                                response: { data: 'data: [DONE]\n\n', ok: true, done: true },
                            });
                        } else if (content && sender?.tab?.id) {
                            chrome.tabs.sendMessage(sender.tab.id, {
                                type: 'streamResponse',
                                response: { data: content, ok: true, done: false },
                            });
                        }
                    } else if (sender?.tab?.id) {
                        handleMessage(chunk, { tab: { id: sender.tab.id } });
                    }
                });
            },
        })
            .then((response) => {
                if (!request.body.includes('"stream":true')) {
                    sendResponse(response);
                }
            })
            .catch((error) => {
                console.log('error', error);
                sendResponse({ ok: false, error: error.message });
            })
            .finally(() => {
                if (sender?.tab?.id) {
                    requestControllers.delete(sender.tab.id);
                }
            });

        return true;
    }

    if (request.action === 'getStorage') {
        storage.get(request.key).then((value) => sendResponse({ value }));
        return true; // 确保 sendResponse 可异步返回
    }

    if (request.action === 'setStorage') {
        storage.set(request.key, request.value).then(() => sendResponse({ success: true }));
        return true;
    }

    return false; // 没有匹配到任务
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'openChatWindow',
        title: '打开 AI 窗口聊天',
        contexts: ['page', 'selection', 'image', 'link'],
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'openChatWindow' && tab?.id !== undefined) {
        console.log('info', info)
        chrome.tabs.sendMessage(tab.id, {
            action: 'openChatWindow',
            selectedText: info.selectionText || '',
        });
    }
});

