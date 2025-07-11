import { ChatDeepSeek } from '@langchain/deepseek';
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

const logger = new Logger('DeepSeekLangChainProvider');

export default class DeepSeekLangChainProvider extends BaseLangChainProvider {
    private chatModel!: ChatDeepSeek;

    constructor(provider: Provider, rootStore?: RootStore) {
        super(provider, rootStore);
        this.chatModel = this.initialize();
    }

    initialize(stream = true): ChatDeepSeek {
        return new ChatDeepSeek({
            model: this.provider.selectedModel?.id || 'deepseek-chat',
            temperature: 0.7,
            streaming: stream,
            apiKey: this.provider.apiKey,
            ...(this.provider.apiHost && {
                configuration: {
                    baseURL: this.provider.apiHost,
                },
            }),
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
            const enhancedUserInput = await this.prepareUserInputWithTools(userInput);

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

            // Check if this is an R1 model (reasoning model)
            const isR1Model =
                this.provider.selectedModel?.id?.includes('reasoner') ||
                this.provider.selectedModel?.id?.includes('R1') ||
                this.provider.selectedModel?.id?.includes('r1');

            let time_first_token_millsec = 0;
            let accumulatedThinking = '';
            let accumulatedText = '';
            let hasEmittedThinkingComplete = false;

            // Stream the response
            const stream = await this.chatModel.stream(langchainMessages, { signal });

            for await (const chunk of stream) {
                if (signal.aborted) {
                    break;
                }

                const content = chunk.content;
                const additionalKwargs = chunk.additional_kwargs || {};

                if (isR1Model && additionalKwargs.reasoning_content) {
                    if (!time_first_token_millsec) {
                        time_first_token_millsec = new Date().getTime();
                    }
                    const reasoningContent = additionalKwargs.reasoning_content as string;
                    logger.info('reasoningContent', reasoningContent);

                    if (reasoningContent.length) {
                        accumulatedThinking += reasoningContent;

                        onChunk({
                            text: reasoningContent,
                            type: ChunkType.THINKING_DELTA,
                            thinking_millsec: new Date().getTime() - time_first_token_millsec,
                        });
                    }
                }

                if (content) {
                    const text = typeof content === 'string' ? content : content.toString();

                    if (text) {
                        if (!hasEmittedThinkingComplete && isR1Model) {
                            onChunk({
                                text: accumulatedThinking,
                                type: ChunkType.THINKING_COMPLETE,
                                thinking_millsec: new Date().getTime() - time_first_token_millsec,
                            });
                            hasEmittedThinkingComplete = true;
                        }

                        accumulatedText += text;
                        onChunk({
                            text: text,
                            type: ChunkType.TEXT_DELTA,
                        });
                    }
                }
            }
            onChunk({
                text: accumulatedText,
                type: ChunkType.TEXT_COMPLETE,
            });

            onChunk({
                type: ChunkType.BLOCK_COMPLETE,
                response: {
                    text: accumulatedText,
                    thinking: accumulatedThinking,
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
