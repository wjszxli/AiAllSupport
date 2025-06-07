import { CompletionsParams, Model, Provider } from '@/types';
import { formatApiHost } from '@/utils';

export default abstract class BaseLlmProvider {
    private provider: Provider;
    protected host: string;
    protected apiKey: string;

    constructor(provider: Provider) {
        this.provider = provider;
        this.host = this.getBaseURL();
        this.apiKey = this.getApiKey();
    }

    public getBaseURL(): string {
        const host = this.provider.apiHost;
        return formatApiHost(host);
    }

    public getApiKey(): string {
        return this.provider.apiKey;
    }

    public defaultHeaders() {
        return {
            // 'HTTP-Referer': '*',
            'X-Title': 'AiAllSupport',
            'X-Api-Key': this.apiKey,
        };
    }

    abstract check(model: Model, stream: boolean): Promise<{ valid: boolean; error: Error | null }>;
    abstract models(provider: Provider): Promise<Model[]>;
    abstract completions({
        messages,
        onChunk,
        onFilterMessages,
        abortController,
    }: CompletionsParams): Promise<void>;
}
