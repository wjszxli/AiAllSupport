import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import BaseLangChainProvider from './BaseLangChainProvider';
import { CompletionsParams, Provider } from '@/types';
import { filterContextMessages, filterEmptyMessages } from '@/utils/message/filters';
import { takeRight } from 'lodash';
import { Message } from '@/types/message';
import { ChunkType } from '@/types/chunk';
import { Logger } from '@/utils/logger';

const logger = new Logger('OpenAiLangChainProvider');

export default class OpenAiLangChainProvider extends BaseLangChainProvider {
    private chatModel!: ChatOpenAI;

    constructor(provider: Provider) {
        super(provider);
        this.chatModel = this.initialize();
    }

    initialize(stream = true): ChatOpenAI {
        let baseURL = this.provider.apiHost;
        if (!this.provider.apiHost.endsWith('/v1')) {
            baseURL = `${this.provider.apiHost}/v1`;
        }
        return new ChatOpenAI({
            modelName: this.provider.selectedModel?.id,
            temperature: 0.7,
            streaming: stream,
            apiKey: this.provider.apiKey,
            configuration: {
                baseURL: baseURL,
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

        onFilterMessages?.(filteredMessages);

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

            let text = '';

            for await (const chunk of stream) {
                const { content } = chunk;

                // 处理正常内容
                if (content) {
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

            onChunk({
                type: ChunkType.BLOCK_COMPLETE,
                response: {
                    text,
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
     * 实现特定于 OpenAI 的模型可用性检查
     */
    protected async checkModelAvailability(): Promise<{ valid: boolean; error: Error | null }> {
        try {
            const checkModel = this.initialize(false);

            // 使用现有的 chatModel 实例进行测试
            await checkModel.invoke([new HumanMessage('test')]);

            return { valid: true, error: null };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error : new Error('Unknown error'),
            };
        }
    }
}
