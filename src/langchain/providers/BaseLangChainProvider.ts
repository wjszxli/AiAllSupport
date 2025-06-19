import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { CompletionsParams, Model, Provider } from '@/types';
import { addAbortController, removeAbortController } from '@/utils/abortController';
import { Logger } from '@/utils';
import { Message } from '@/types/message';
import { getMainTextContent } from '@/utils/message/find';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

const logger = new Logger('BaseLangChainProvider');

export default abstract class BaseLangChainProvider {
    protected provider: Provider;
    protected model: BaseLanguageModel | null = null;

    constructor(provider: Provider) {
        this.provider = provider;
    }

    async convertToLangChainMessages(messages: Message[]) {
        const langchainMessages = [];

        for (const message of messages) {
            const content = getMainTextContent(message);

            if (message.role === 'user') {
                langchainMessages.push(new HumanMessage(content));
            } else if (message.role === 'assistant') {
                langchainMessages.push(new AIMessage(content));
            } else if (message.role === 'system') {
                langchainMessages.push(new SystemMessage(content));
            }
        }

        return langchainMessages;
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
                    logger.error('Error in cleanup:', error);
                    logger.error(
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
                            logger.error('Error in abortHandler:', error);
                            logger.error(
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
            logger.error('Error in createAbortController:', error);
            logger.error(
                'Stack trace:',
                error instanceof Error ? error.stack : 'No stack trace available',
            );
            throw error;
        }
    }

    /**
     * 通用的模型检查方法，验证API密钥和主机
     * 子类可以覆盖此方法以提供特定的实现
     */
    async check(model: Model): Promise<{ valid: boolean; error: Error | null }> {
        try {
            // 验证API密钥（如果需要）
            if (this.provider.requiresApiKey !== false && !this.provider.apiKey) {
                return { valid: false, error: new Error('API key is required') };
            }

            // 验证API主机
            if (!this.provider.apiHost) {
                return { valid: false, error: new Error('API host is required') };
            }

            // 子类需要实现具体的模型检查逻辑
            return await this.checkModelAvailability(model);
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error : new Error('Unknown error'),
            };
        }
    }

    /**
     * 子类需要实现此方法来检查特定模型的可用性
     */
    protected abstract checkModelAvailability(
        model: Model,
    ): Promise<{ valid: boolean; error: Error | null }>;

    abstract initialize(): void;

    abstract completions({
        messages,
        robot,
        onChunk,
        onFilterMessages,
    }: CompletionsParams): Promise<void>;

    abstract models(provider: Provider): Promise<Model[]>;
}
