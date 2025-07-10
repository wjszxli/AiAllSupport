import { ChatOllama } from '@langchain/ollama';
import { HumanMessage } from '@langchain/core/messages';
import BaseLangChainProvider from './BaseLangChainProvider';
import { CompletionsParams, Provider } from '@/types';
import type { RootStore } from '@/store';
import { filterContextMessages, filterEmptyMessages } from '@/utils/message/filters';
import { getMainTextContent } from '@/utils/message/find';
import { takeRight } from 'lodash';
import { Message } from '@/types/message';
import { ChunkType } from '@/types/chunk';
import { Logger } from '@/utils/logger';

const logger = new Logger('OllamaLangChainProvider');

export default class OllamaLangChainProvider extends BaseLangChainProvider {
    private chatModel!: ChatOllama;

    constructor(provider: Provider, rootStore?: RootStore) {
        super(provider, rootStore);
        this.chatModel = this.initialize();
    }

    initialize(stream = true): ChatOllama {
        return new ChatOllama({
            model: this.provider.selectedModel?.id || 'llama2',
            temperature: 0.7,
            streaming: stream,
            baseUrl: this.provider.apiHost,
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

        // Get the last user message
        const lastUserMessage = filteredMessages
            .slice()
            .reverse()
            .find((m: Message) => m.role === 'user');

        if (!lastUserMessage) {
            throw new Error('No user message found');
        }

        const userInput = getMainTextContent(lastUserMessage);

        onChunk({
            type: ChunkType.LLM_RESPONSE_CREATED,
        });

        // Create abort controller
        const { abortController, cleanup, signalPromise } = this.createAbortController(
            lastUserMessage?.id,
            true,
        );

        const { signal } = abortController;

        try {
            onChunk({
                type: ChunkType.LLM_RESPONSE_IN_PROGRESS,
            });

            // Use the centralized tool-based completion from BaseLangChainProvider
            const finalText = await this.handleToolBasedCompletion(
                filteredMessages,
                robot,
                userInput,
                signal,
            );

            // Stream the final text
            onChunk({
                text: finalText,
                type: ChunkType.TEXT_DELTA,
            });

            onChunk({
                text: finalText,
                type: ChunkType.TEXT_COMPLETE,
            });

            onChunk({
                type: ChunkType.BLOCK_COMPLETE,
                response: {
                    text: finalText,
                } as any,
            });
        } catch (error) {
            logger.error('Error in completions:', error);

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

    protected async executeDirectCompletion(
        langchainMessages: any[],
        signal: AbortSignal,
    ): Promise<string> {
        const response = await this.chatModel.invoke(langchainMessages, { signal });
        return response.content as string;
    }

    protected async checkModelAvailability(): Promise<{ valid: boolean; error: Error | null }> {
        try {
            const checkModel = this.initialize(false);
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
