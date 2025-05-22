import AiProvider from '@/llmProviders/AiProvider';
import { Model, Provider } from '@/types';
import { Message } from '@/types/message';
import { Chunk } from '@/types/chunk';
import { filterContextMessages, filterUsefulMessages } from '@/utils/message/filters';
import { findLast } from 'lodash';
import rootStore from '@/store';

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
    onChunkReceived,
}: {
    messages: Message[];
    onChunkReceived: (chunk: Chunk) => void;
}) {
    const { llmStore } = rootStore;
    const defaultModel = llmStore.defaultModel;
    const provider = llmStore.providers.find((p) => p.id === defaultModel.provider);
    if (!provider) {
        throw new Error('Provider not found');
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

    console.log('filteredMessages', filteredMessages);

    await AI.completions({
        messages: filteredMessages,
        onFilterMessages: () => {},
        onChunk: onChunkReceived,
    });
}
