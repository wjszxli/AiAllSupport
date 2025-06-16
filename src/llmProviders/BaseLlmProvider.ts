import { CompletionsParams, Model, Provider } from '@/types';
import { formatApiHost } from '@/utils';
import { addAbortController, removeAbortController } from '@/utils/abortController';

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

    protected createAbortController(messageId?: string, isAddEventListener?: boolean) {
        const abortController = new AbortController();
        const abortFn = () => abortController.abort();

        if (messageId) {
            addAbortController(messageId, abortFn);
        }

        const signalPromise: {
            resolve: (value: unknown) => void;
            promise: Promise<unknown>;
        } = {
            resolve: () => {},
            promise: Promise.resolve(),
        };

        const cleanup = () => {
            if (messageId) {
                signalPromise.resolve?.(undefined);
                removeAbortController(messageId, abortFn);
            }
        };

        if (isAddEventListener) {
            signalPromise.promise = new Promise((resolve, reject) => {
                signalPromise.resolve = resolve;

                const abortHandler = () => {
                    reject(new Error('Operation aborted'));
                };

                if (abortController.signal.aborted) {
                    abortHandler();
                }

                abortController.signal.addEventListener('abort', abortHandler);
            });

            return {
                abortController,
                cleanup,
                signalPromise,
            };
        }

        return {
            abortController,
            cleanup,
            signalPromise,
        };
    }

    abstract check(model: Model, stream: boolean): Promise<{ valid: boolean; error: Error | null }>;
    abstract models(provider: Provider): Promise<Model[]>;
    abstract completions({
        messages,
        robot,
        onChunk,
        onFilterMessages,
    }: CompletionsParams): Promise<void>;
}
