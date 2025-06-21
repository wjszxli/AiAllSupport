import LangChainService from '@/langchain/services/LangChainService';
import { ConfigModelType, Provider, Robot } from '@/types';
import { Message } from '@/types/message';
import { Chunk } from '@/types/chunk';
import { filterContextMessages } from '@/utils/message/filters';
import { findLast } from 'lodash';
import { getModelForInterface } from '@/utils';

import llmStore from '@/store/llm';

export const checkApiProvider = async (provider: Provider) => {
    const langChainService = new LangChainService(provider);
    const result = await langChainService.check();
    if (result.valid && !result.error) {
        return result;
    }
    return langChainService.check();
};

export const getModels = async (provider: Provider) => {
    const langChainService = new LangChainService(provider);
    return langChainService.getModels(provider);
};

export async function fetchChatCompletion({
    messages,
    robot,
    onChunkReceived,
    interfaceType = ConfigModelType.CHAT,
}: {
    messages: Message[];
    robot: Robot;
    onChunkReceived: (chunk: Chunk) => void;
    interfaceType?: ConfigModelType;
}) {
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
        console.error('fetchChatCompletion returning early: Missing lastUserMessage or lastAnswer');
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
