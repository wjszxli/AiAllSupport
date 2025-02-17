import { ProviderConfig } from '@/typings';

export const SERVICE_MAP = {
    DeepSeek: {
        chat: '/chat/completions',
    },
    Ollama: {
        chat: '/api/chat',
        modelList: '/api/tags',
    },
    SiliconFlow: {
        chat: '/v1/chat/completions',
    },
    Tencent: {
        chat: '/v1/chat/completions',
    },
    Baidu: {
        chat: '/v2/chat/completions',
    },
    Aliyun: {
        chat: '/compatible-mode/v1/chat/completions',
    },
};

export const PROVIDERS_DATA: Record<string, ProviderConfig> = {
    DeepSeek: {
        name: 'DeepSeek',
        apiKey: null,
        apiKeyUrl: 'https://platform.deepseek.com/api_keys',
        models: [
            { label: 'V3', value: 'deepseek-chat' },
            { label: 'R1', value: 'deepseek-reasoner' },
        ],
    },
    Ollama: {
        name: '本地 Ollama',
        apiKey: null,
        apiKeyUrl: 'https://ollama.com/api_keys',
        models: [],
    },
    SiliconFlow: {
        name: '硅基流动',
        apiKey: null,
        apiKeyUrl: 'https://cloud.siliconflow.cn/account/ak',
        models: [
            { label: 'V3', value: 'deepseek-ai/DeepSeek-V3' },
            { label: 'R1', value: 'deepseek-ai/DeepSeek-R1' },
        ],
    },
    Tencent: {
        name: '腾讯云',
        apiKey: null,
        apiKeyUrl: 'https://console.cloud.tencent.com/lkeap/api',
        models: [
            { label: 'V3', value: 'deepseek-v3' },
            { label: 'R1', value: 'deepseek-r1' },
        ],
    },
    Baidu: {
        name: '百度云',
        apiKey: null,
        apiKeyUrl: 'https://console.bce.baidu.com/iam/#/iam/apikey/list',
        models: [
            { label: 'V3', value: 'deepseek-v3' },
            { label: 'R1', value: 'deepseek-r1' },
        ],
    },
    Aliyun: {
        name: '阿里云',
        apiKey: null,
        apiKeyUrl: 'https://bailian.console.aliyun.com/?apiKey=1#/api-key',
        models: [
            { label: 'V3', value: 'deepseek-v3' },
            { label: 'R1', value: 'deepseek-r1' },
        ],
    },
};

export const URL_MAP = {
    DeepSeek: 'https://api.deepseek.com',
    Ollama: 'http://127.0.0.1:11434',
    SiliconFlow: 'https://api.siliconflow.com',
    Tencent: 'https://api.lkeap.cloud.tencent.com',
    Baidu: 'https://qianfan.baidubce.com',
    Aliyun: 'https://dashscope.aliyuncs.com',
};

export const CHAT_BOX_ID = 'custom-chat-box';
export const CHAT_BUTTON_ID = 'custom-chat-button';
export const CHAT_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/847/847969.png'; // 你可以换成更好看的图标

export const GIT_URL = 'https://github.com/wjszxli/DeepSeekAllSupports';

export const MODIFY_HEADERS_RULE_ID = 1001;


export const tags = ["think", "reason", "reasoning", "thought"]

export const SHORTCUTS_URL = 'chrome://extensions/shortcuts'