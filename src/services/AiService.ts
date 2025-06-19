import LangChainService from '@/langchain/services/LangChainService';
import { Model, Provider, Robot } from '@/types';
import { Message } from '@/types/message';
import { Chunk } from '@/types/chunk';
import { filterContextMessages } from '@/utils/message/filters';
import { findLast } from 'lodash';

import llmStore from '@/store/llm';

export const checkApiProvider = async (provider: Provider, model: Model) => {
    // if (USE_LANGCHAIN) {
    const langChainService = new LangChainService(provider);
    const result = await langChainService.check(model);
    if (result.valid && !result.error) {
        return result;
    }
    return langChainService.check(model);
    // } else {
    //     const ai = new AiProvider(provider);
    //     const result = await ai.check(model, true);
    //     if (result.valid && !result.error) {
    //         return result;
    //     }
    //     return ai.check(model, false);
    // }
};

export const getModels = async (provider: Provider) => {
    // if (USE_LANGCHAIN) {
    const langChainService = new LangChainService(provider);
    return langChainService.getModels(provider);
    // } else {
    //     const ai = new AiProvider(provider);
    //     return ai.models(provider);
    // }
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
    console.log('robot', robot);

    if (!provider) {
        throw new Error('Provider not found');
    }

    messages = filterContextMessages(messages);

    const lastUserMessage = findLast(messages, (m) => m.role === 'user');
    if (!lastUserMessage) {
        console.error('fetchChatCompletion returning early: Missing lastUserMessage or lastAnswer');
        return;
    }

    // if (USE_LANGCHAIN) {
    const langChainService = new LangChainService(provider);
    await langChainService.completions({
        messages,
        robot,
        onChunk: onChunkReceived,
    });
    // } else {
    //     const AI = new AiProvider(provider);
    //     const filteredMessages = filterUsefulMessages(messages);
    //     await AI.completions({
    //         messages: filteredMessages,
    //         robot,
    //         onFilterMessages: () => {},
    //         onChunk: onChunkReceived,
    //     });
    // }
}
