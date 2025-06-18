import { CompletionsParams, Model, Provider } from '@/types';
import { formatApiHost } from '@/utils';
import { addAbortController, removeAbortController } from '@/utils/abortController';

export default abstract class BaseLlmProvider {
    protected provider: Provider;
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
        // If the provider doesn't require an API key, return an empty string
        if (this.provider.requiresApiKey === false) {
            return '';
        }
        return this.provider.apiKey;
    }

    public defaultHeaders() {
        const headers: Record<string, string> = {
            'X-Title': 'AiAllSupport',
            'HTTP-Referer': '*',
        };

        // Only add API key to headers if it exists
        if (this.apiKey) {
            headers['X-Api-Key'] = this.apiKey;
        }

        return headers;
    }

    protected createAbortController(messageId?: string, isAddEventListener?: boolean) {
        try {
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
                try {
                    if (messageId) {
                        signalPromise.resolve?.(undefined);
                        removeAbortController(messageId, abortFn);
                    }
                } catch (error) {
                    console.error('[BaseLlmProvider] Error in cleanup:', error);
                    console.error(
                        'Stack trace:',
                        error instanceof Error ? error.stack : 'No stack trace available',
                    );
                }
            };

            if (isAddEventListener) {
                signalPromise.promise = new Promise((resolve, reject) => {
                    signalPromise.resolve = resolve;

                    const abortHandler = () => {
                        try {
                            reject(new Error('Operation aborted'));
                        } catch (error) {
                            console.error('[BaseLlmProvider] Error in abortHandler:', error);
                            console.error(
                                'Stack trace:',
                                error instanceof Error ? error.stack : 'No stack trace available',
                            );
                        }
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
        } catch (error) {
            console.error('[BaseLlmProvider] Error in createAbortController:', error);
            console.error(
                'Stack trace:',
                error instanceof Error ? error.stack : 'No stack trace available',
            );
            throw error;
        }
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
