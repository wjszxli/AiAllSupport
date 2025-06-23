import { Model, Provider, Robot } from '@/types';
import { ConfigModelType } from '@/types';
import { Message } from '@/types/message';
import { Chunk } from '@/types/chunk';
import BaseLangChainProvider from '../providers/BaseLangChainProvider';
import LangChainProviderFactory from '../providers/LangChainProviderFactory';
import { filterContextMessages, filterUsefulMessages } from '@/utils/message/filters';
import { findLast } from 'lodash';
import { getModelForInterface, navigateToSettings, requiresApiKey } from '@/utils';
import llmStore from '@/store/llm';

export default class LangChainService {
    private provider: BaseLangChainProvider;

    constructor(provider: Provider) {
        // 检测 apiKey 是否需要配置
        this.checkApiKey(provider);

        this.provider = LangChainProviderFactory.create(provider);
    }

    private checkApiKey(provider: Provider) {
        // 如果不需要 apiKey，跳过检测
        if (!requiresApiKey(provider)) {
            return;
        }

        // 如果需要 apiKey 但没有值，弹出提示
        if (!provider.apiKey || provider.apiKey.trim() === '') {
            this.showApiKeyMissingDialog(provider);
        }
    }

    private showApiKeyMissingDialog(provider: Provider) {
        const providerName = provider.name || provider.id;

        // 延迟弹窗，避免阻塞构造函数
        setTimeout(() => {
            if (typeof window !== 'undefined' && window.confirm) {
                const userConfirmed = window.confirm(
                    `${providerName} 需要配置 API Key 才能正常使用。\n\n是否现在前往设置页面进行配置？`,
                );

                if (userConfirmed) {
                    navigateToSettings();
                }
            } else {
                // 在非浏览器环境中，使用 console 提示
                console.warn(
                    `${providerName} requires API Key configuration. Please configure it in settings.`,
                );
            }
        }, 100);
    }

    async check(): Promise<{ valid: boolean; error: Error | null }> {
        return this.provider.check();
    }

    async getModels(provider: Provider): Promise<Model[]> {
        return this.provider.models(provider);
    }

    async completions({
        messages,
        robot,
        onChunk,
        onFilterMessages,
    }: {
        messages: Message[];
        robot: Robot;
        onChunk: (chunk: Chunk) => void;
        onFilterMessages?: (messages: Message[]) => void;
    }): Promise<void> {
        // 确保消息已经过滤
        messages = filterContextMessages(messages);

        const lastUserMessage = findLast(messages, (m) => m.role === 'user');
        if (!lastUserMessage) {
            console.error('completions returning early: Missing lastUserMessage');
            return;
        }

        const filteredMessages = filterUsefulMessages(messages);

        await this.provider.completions({
            messages: filteredMessages,
            robot,
            onChunk,
            onFilterMessages: onFilterMessages || (() => {}),
        });
    }

    // Static methods merged from AiService.ts
    static async checkApiProvider(
        provider: Provider,
    ): Promise<{ valid: boolean; error: Error | null }> {
        const langChainService = new LangChainService(provider);
        const result = await langChainService.check();
        if (result.valid && !result.error) {
            return result;
        }
        return langChainService.check();
    }

    static async getModels(provider: Provider): Promise<Model[]> {
        const langChainService = new LangChainService(provider);
        return langChainService.getModels(provider);
    }

    static async fetchChatCompletion({
        messages,
        robot,
        onChunkReceived,
        interfaceType = ConfigModelType.CHAT,
    }: {
        messages: Message[];
        robot: Robot;
        onChunkReceived: (chunk: Chunk) => void;
        interfaceType?: ConfigModelType;
    }): Promise<void> {
        const model = getModelForInterface(interfaceType);
        const provider = llmStore.providers.find((p) => p.id === model.provider);

        if (!provider) {
            throw new Error('Provider not found');
        }

        robot.model = model;
        provider.selectedModel = model;

        messages = filterContextMessages(messages);

        const lastUserMessage = findLast(messages, (m) => m.role === 'user');
        if (!lastUserMessage) {
            console.error(
                'fetchChatCompletion returning early: Missing lastUserMessage or lastAnswer',
            );
            return;
        }

        const langChainService = new LangChainService(provider);
        await langChainService.completions({
            messages,
            robot,
            onChunk: onChunkReceived,
            onFilterMessages: (filteredMessages) => {
                console.log('Filtered messages:', filteredMessages.length);
            },
        });
    }
}
