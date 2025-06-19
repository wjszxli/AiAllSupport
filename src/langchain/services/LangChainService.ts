import { Model, Provider, Robot } from '@/types';
import { Message } from '@/types/message';
import { Chunk } from '@/types/chunk';
import BaseLangChainProvider from '../providers/BaseLangChainProvider';
import LangChainProviderFactory from '../providers/LangChainProviderFactory';
import { filterContextMessages, filterUsefulMessages } from '@/utils/message/filters';
import { findLast } from 'lodash';

export default class LangChainService {
    private provider: BaseLangChainProvider;

    constructor(provider: Provider) {
        this.provider = LangChainProviderFactory.create(provider);
    }

    async check(model: Model): Promise<{ valid: boolean; error: Error | null }> {
        return this.provider.check(model);
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
}
