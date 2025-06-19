import { ChatDeepSeek } from '@langchain/deepseek';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import BaseLangChainProvider from './BaseLangChainProvider';
import { CompletionsParams, Model, Provider } from '@/types';
import { filterContextMessages, filterEmptyMessages } from '@/utils/message/filters';
import { takeRight } from 'lodash';
import { Message } from '@/types/message';
import { ChunkType } from '@/types/chunk';
import { Logger } from '@/utils/logger';

const logger = new Logger('DeepSeekLangChainProvider');

export default class DeepSeekLangChainProvider extends BaseLangChainProvider {
    private chatModel!: ChatDeepSeek;

    constructor(provider: Provider) {
        super(provider);
        this.initialize();
    }

    initialize(): void {
        this.chatModel = new ChatDeepSeek({
            modelName: this.provider.models?.[0]?.id,
            temperature: 0.7,
            streaming: true,
            apiKey: this.provider.apiKey,
            configuration: {
                baseURL: this.provider.apiHost,
            },
        });
    }

    async completions({
        messages,
        robot,
        onChunk,
        onFilterMessages,
    }: CompletionsParams): Promise<void> {
        const contextCount = 5;
        const filteredMessages = filterEmptyMessages(
            filterContextMessages(takeRight(messages, contextCount + 1)),
        );

        onFilterMessages(filteredMessages);

        const langchainMessages = await this.convertToLangChainMessages(filteredMessages);

        if (robot.prompt) {
            langchainMessages.unshift(new SystemMessage(robot.prompt));
        }

        onChunk({
            type: ChunkType.LLM_RESPONSE_CREATED,
        });

        // 获取最后一条用户消息，用于中止控制
        const lastUserMessage = filteredMessages
            .slice()
            .reverse()
            .find((m: Message) => m.role === 'user');

        // 创建中止控制器
        const { abortController, cleanup, signalPromise } = this.createAbortController(
            lastUserMessage?.id,
            true,
        );

        const { signal } = abortController;

        try {
            onChunk({
                type: ChunkType.LLM_RESPONSE_IN_PROGRESS,
            });

            // 将 signal 传递给 LangChain
            const stream = await this.chatModel.stream(langchainMessages, {
                signal: signal,
            });

            let thinking = '';
            let text = '';
            let hasThinking = false;
            let time_first_token_millsec = 0;

            for await (const chunk of stream) {
                const { content, additional_kwargs } = chunk;

                if (additional_kwargs) {
                    if (!time_first_token_millsec) {
                        time_first_token_millsec = new Date().getTime();
                    }

                    const { reasoning_content } = additional_kwargs;
                    thinking += reasoning_content;
                    hasThinking = true;
                    onChunk({
                        text: reasoning_content as string,
                        type: ChunkType.THINKING_DELTA,
                        thinking_millsec: new Date().getTime() - time_first_token_millsec,
                    });
                }

                if (content) {
                    if (hasThinking) {
                        onChunk({
                            text: thinking,
                            type: ChunkType.THINKING_COMPLETE,
                            thinking_millsec: new Date().getTime() - time_first_token_millsec,
                        });
                        hasThinking = false;
                    }

                    text += content;
                    onChunk({
                        text: content as string,
                        type: ChunkType.TEXT_DELTA,
                    });
                }
            }

            onChunk({
                text: text,
                type: ChunkType.TEXT_COMPLETE,
            });

            // Signal that the entire response is complete
            onChunk({
                type: ChunkType.BLOCK_COMPLETE,
                response: {
                    text,
                    thinking,
                } as any,
            });
        } catch (error) {
            logger.error('Error in completions:', error);
            // 检查是否是中止错误
            if (signal.aborted) {
                logger.info('Request aborted by user');
                onChunk({
                    type: ChunkType.ERROR,
                    error: { message: 'Request aborted by user' },
                });
            } else {
                onChunk({
                    type: ChunkType.ERROR,
                    error: { message: (error as Error).message || 'Unknown error' },
                });
            }
        } finally {
            cleanup();
        }

        await signalPromise?.promise?.catch((error) => {
            throw error;
        });
    }

    /**
     * 实现特定于 DeepSeek 的模型可用性检查
     */
    protected async checkModelAvailability(
        model: Model,
    ): Promise<{ valid: boolean; error: Error | null }> {
        try {
            // 如果需要检查的模型与当前模型不同，或者当前模型未初始化，则更新模型配置
            if (!this.chatModel || this.chatModel.modelName !== model.id) {
                this.initialize()
            }

            // 使用现有的 chatModel 实例进行测试
            await this.chatModel.invoke([new HumanMessage('test')]);

            return { valid: true, error: null };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error : new Error('Unknown error'),
            };
        }
    }

    async models(provider: Provider): Promise<Model[]> {
        // Return default models for DeepSeek
        return [
            {
                id: 'deepseek-chat',
                name: 'DeepSeek Chat',
                provider: provider.id,
                group: 'DeepSeek',
            },
        ];
    }
}
