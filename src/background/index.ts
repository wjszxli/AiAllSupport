import { fetchData } from '@/utils';
import storage from '@/utils/storage';

// chrome.runtime.onInstalled.addListener((details) => {
//     if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
//         // 打开说明页面
//         chrome.tabs.create({
//             url: chrome.runtime.getURL('/Instructions.html'),
//         });
//     }
// });

const requestControllers = new Map();

// 监听 `popup.ts` 或 `content.ts` 发送的消息，并代理 API 请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('request.action', request.action);
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
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.trim() === '' || !line.startsWith('data: ')) continue;

                    const data = line.slice(6);
                    console.log('data', data)
                    console.log('first', data === '[DONE]')
                    if (data === '[DONE]') {
                        console.log('sender?.tab?.id', sender?.tab?.id)
                        if (sender?.tab?.id) {
                            chrome.tabs.sendMessage(sender.tab.id, {
                                type: 'streamResponse',
                                response: { data: 'data: [DONE]\n\n', ok: true, done: true },
                            });
                        }
                        break;
                    }

                    if (sender?.tab?.id) {
                        chrome.tabs.sendMessage(sender.tab.id, {
                            type: 'streamResponse',
                            response: { data: line + '\n\n', ok: true, done: false },
                        });
                    }
                }
            },
        })
            .then((response) => {
                if (!request.body.includes('"stream":true')) {
                    sendResponse({ status: response.status, ok: response.ok });
                }
            })
            .catch((error) => {
                console.log('error', error)
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

// 对 fetchData 进行修改，流数据通过
