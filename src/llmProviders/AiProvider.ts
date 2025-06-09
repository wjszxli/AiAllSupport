import { CompletionsParams, Model, Provider } from '@/types';
import BaseLlmProvider from './BaseLlmProvider';
import LlmProviderFactory from './LlmProviderFactory';

export default class AiProvider {
    private sdk: BaseLlmProvider;

    constructor(provider: Provider) {
        this.sdk = LlmProviderFactory.create(provider);
    }

    public async check(
        model: Model,
        stream: boolean = false,
    ): Promise<{ valid: boolean; error: Error | null }> {
        return this.sdk.check(model, stream);
    }

    public async models(provider: Provider): Promise<Model[]> {
        return this.sdk.models(provider);
    }

    public async completions({
        messages,
        onChunk,
        onFilterMessages,
    }: CompletionsParams): Promise<void> {
        return this.sdk.completions({
            messages,
            onChunk,
            onFilterMessages,
        });
    }
}
