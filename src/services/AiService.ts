import AiProvider from '@/llmProviders/AiProvider';
import { Model, Provider, Robot } from '@/types';
import { Message } from '@/types/message';
import { Chunk } from '@/types/chunk';
import { filterContextMessages, filterUsefulMessages } from '@/utils/message/filters';
import { findLast } from 'lodash';

import llmStore from '@/store/llm';

export const checkApiProvider = async (provider: Provider, model: Model) => {
    const ai = new AiProvider(provider);
    const result = await ai.check(model, true);
    if (result.valid && !result.error) {
        return result;
    }

    return ai.check(model, false);
};

export const getModels = async (provider: Provider) => {
    const ai = new AiProvider(provider);
    return ai.models(provider);
};

export async function fetchChatCompletion({
    messages,
    robot,
    onChunkReceived,
}: {
    messages: Message[];
    robot: Robot;
    onChunkReceived: (chunk: Chunk) => void;
    abortController?: AbortController;
}) {
    const provider = llmStore.providers.find((p) => p.id === robot.model?.provider);
    console.log('provider', provider);

    if (!provider) {
        throw new Error('Provider not found');
    }

    // 确保 provider 有最新的 apiKey
    if (!provider.apiKey && robot.model?.provider) {
        // 从 llmStore 重新获取 provider，确保数据是最新的
        console.log('Provider apiKey is empty, trying to get from store');
        const freshProvider = llmStore.providers.find((p) => p.id === robot.model?.provider);
        if (freshProvider && freshProvider.apiKey) {
            Object.assign(provider, freshProvider);
        }
    }

    if (!provider.apiKey) {
        console.error('Provider apiKey is empty', provider);
        throw new Error(`API Key for ${provider.name} is not set. Please set it in the settings.`);
    }

    const AI = new AiProvider(provider);

    // Make sure that 'Clear Context' works for all scenarios including external tool and normal chat.
    messages = filterContextMessages(messages);

    const lastUserMessage = findLast(messages, (m) => m.role === 'user');
    if (!lastUserMessage) {
        console.error('fetchChatCompletion returning early: Missing lastUserMessage or lastAnswer');
        return;
    }

    const filteredMessages = filterUsefulMessages(messages);

    await AI.completions({
        messages: filteredMessages,
        onFilterMessages: () => {},
        onChunk: onChunkReceived,
    });
}
