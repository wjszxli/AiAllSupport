import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
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

            // Prepare user input with tools if available
            const enhancedUserInput = await this.prepareUserInputWithTools(userInput, onChunk);

            // Convert messages to LangChain format
            const langchainMessages = await this.convertToLangChainMessages(filteredMessages);

            // Replace the last user message with enhanced input if tools were used
            if (enhancedUserInput !== userInput && langchainMessages.length > 0) {
                const lastMsg = langchainMessages[langchainMessages.length - 1];
                if (lastMsg instanceof HumanMessage) {
                    langchainMessages[langchainMessages.length - 1] = new HumanMessage(
                        enhancedUserInput,
                    );
                }
            }

            // Add robot prompt if available
            if (robot.prompt) {
                langchainMessages.unshift(new SystemMessage(robot.prompt));
            }

            // Stream the response
            const stream = await this.chatModel.stream(langchainMessages, { signal });

            for await (const chunk of stream) {
                if (signal.aborted) {
                    break;
                }

                const content = chunk.content;
                if (content) {
                    onChunk({
                        text: typeof content === 'string' ? content : content.toString(),
                        type: ChunkType.TEXT_DELTA,
                    });
                }
            }

            onChunk({
                type: ChunkType.BLOCK_COMPLETE,
                response: {
                    text: '', // The full text is already sent via TEXT_DELTA chunks
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
