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

            let thinkingStartTime = Date.now();
            let accumulatedThinking = '';
            let hasEmittedThinkingComplete = false;

            // Stream the response
            const stream = await this.chatModel.stream(langchainMessages, { signal });

            for await (const chunk of stream) {
                logger.info('chunk', chunk);
                if (signal.aborted) {
                    break;
                }

                const content = chunk.content;
                const additionalKwargs = chunk.additional_kwargs || {};

                if (isR1Model && additionalKwargs.reasoning_content) {
                    const reasoningContent = additionalKwargs.reasoning_content as string;
                    logger.info('reasoningContent', reasoningContent);

                    if (!reasoningContent.length) {
                        accumulatedThinking += reasoningContent;

                        onChunk({
                            text: reasoningContent,
                            type: ChunkType.THINKING_DELTA,
                            thinking_millsec: Date.now() - thinkingStartTime,
                        });
                    }
                }

                if (content) {
                    const text = typeof content === 'string' ? content : content.toString();

                    if (text) {
                        onChunk({
                            text: text,
                            type: ChunkType.TEXT_DELTA,
                        });
                    }
                }

                // if (isR1Model && accumulatedThinking && !hasEmittedThinkingComplete) {
                //     // We'll emit thinking complete when we reach the end or when no more reasoning content is coming
                //     const isLastChunk =
                //         !content || (typeof content === 'string' && content.trim() === '');
                //     if (isLastChunk || !additionalKwargs.reasoning_content) {
                //         hasEmittedThinkingComplete = true;
                //         onChunk({
                //             text: accumulatedThinking,
                //             type: ChunkType.THINKING_COMPLETE,
                //             thinking_millsec: Date.now() - thinkingStartTime,
                //         });
                //     }
                // }
            }

            // Ensure we emit thinking complete if we haven't already
            if (isR1Model && accumulatedThinking && !hasEmittedThinkingComplete) {
                onChunk({
                    text: accumulatedThinking,
                    type: ChunkType.THINKING_COMPLETE,
                    thinking_millsec: Date.now() - thinkingStartTime,
                });
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
