import { CompletionsParams, Model, Provider } from '@/types';
import { Message } from '@/types/message';
import OpenAI from 'openai';
import {
    ChatCompletionCreateParamsNonStreaming,
    ChatCompletionMessageParam,
} from 'openai/resources';
import BaseLlmProvider from './BaseLlmProvider';
import { isEmpty, takeRight } from 'lodash';
import { getDefaultGroupName } from '@/utils';
import { getMainTextContent } from '@/utils/message/find';
import { processReqMessages } from '@/services/ModelMessageService';
import { ChunkType } from '@/types/chunk';
import {
    asyncGeneratorToReadableStream,
    extractReasoningMiddleware,
    openAIChunkToTextDelta,
    readableStreamAsyncIterable,
} from './utils';
import store from '@/store';
import { filterContextMessages, filterEmptyMessages } from '@/utils/message/filters';

export const NOT_SUPPORTED_REGEX = /(?:^tts|whisper|speech)/i;

export type OpenAIStreamChunk =
    | { type: 'reasoning' | 'text-delta'; textDelta: string }
    | { type: 'tool-calls'; delta: any }
    | { type: 'finish'; finishReason: any; usage: any; delta: any; chunk: any };

export function isSupportedModel(model: OpenAI.Models.Model): boolean {
    if (!model) {
        return false;
    }

    return !NOT_SUPPORTED_REGEX.test(model.id);
}

export default class OpenAiLlmProvider extends BaseLlmProvider {
    protected sdk: OpenAI;

    constructor(provider: Provider) {
        super(provider);

        this.sdk = new OpenAI({
            dangerouslyAllowBrowser: true,
            apiKey: this.apiKey,
            baseURL: this.getBaseURL(),
            defaultHeaders: {
                ...this.defaultHeaders(),
            },
        });
    }

    public async check(
        model: Model,
        stream: boolean = false,
    ): Promise<{ valid: boolean; error: Error | null }> {
        if (!model) {
            return { valid: false, error: new Error('No model found') };
        }

        const body: any = {
            model: model.id,
            messages: [{ role: 'user', content: 'hi' }],
            stream,
        };

        try {
            if (!stream) {
                const response = await this.sdk.chat.completions.create(
                    body as ChatCompletionCreateParamsNonStreaming,
                );
                if (!response?.choices[0].message) {
                    throw new Error('Empty response');
                }
                return { valid: true, error: null };
            } else {
                const response: any = await this.sdk.chat.completions.create(body as any);
                // 等待整个流式响应结束
                let hasContent = false;
                for await (const chunk of response) {
                    if (chunk.choices?.[0]?.delta?.content) {
                        hasContent = true;
                    }
                }
                if (hasContent) {
                    return { valid: true, error: null };
                }
                throw new Error('Empty streaming response');
            }
        } catch (error: any) {
            return {
                valid: false,
                error,
            };
        }
    }

    public async models(provider: Provider): Promise<Model[]> {
        try {
            const response = await this.sdk.models.list();
            let models = response.data || [];
            models.forEach((model) => {
                model.id = model.id.trim();
            });
            models = models.filter(isSupportedModel);

            const newModels = models
                .map((model) => ({
                    id: model.id,
                    // @ts-ignore
                    name: model.name || model.id,
                    provider: provider.id,
                    group: getDefaultGroupName(model.id, provider.id),
                    // @ts-ignore name
                    description: model?.description,
                    owned_by: model?.owned_by,
                }))
                .filter((model) => !isEmpty(model.name));

            return newModels;
        } catch (error) {
            return [];
        }
    }

    /**
     * 获取消息内容
     * @param message - 消息对象
     * @returns 处理后的内容文本
     */
    async getMessageContent(message: Message): Promise<string> {
        // 获取主文本内容
        const content = getMainTextContent(message);
        if (isEmpty(content)) {
            return '';
        }

        return content;
    }

    /**
     * 获取消息参数
     * @param message - 消息对象
     * @param model - 模型对象
     * @returns 格式化后的消息参数
     */
    async getMessageParam(
        message: Message,
    ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam> {
        // 获取消息内容
        const content = await this.getMessageContent(message);

        return {
            // 将系统消息角色转换为用户角色，其他角色保持不变
            role: message.role === 'system' ? 'user' : message.role,
            content,
        };
    }

    public async completions({
        messages,
        robot,
        onChunk,
        onFilterMessages,
    }: CompletionsParams): Promise<void> {
        const model = store.llmStore.defaultModel;
        const contextCount = 5;
        // 准备请求消息
        const userMessages: ChatCompletionMessageParam[] = [];
        const _messages = filterEmptyMessages(
            filterContextMessages(takeRight(messages, contextCount + 1)),
        );

        onFilterMessages(_messages);

        // 转换消息格式
        for (const message of _messages) {
            userMessages.push(await this.getMessageParam(message));
        }

        const systemMessage = { role: 'system', content: robot.prompt || '' };

        const lastUserMessage = _messages
            .slice()
            .reverse()
            .find((m: Message) => m.role === 'user');
        console.log('[OpenAiLlmProvider] lastUserMessage', lastUserMessage);

        const { abortController, cleanup, signalPromise } = this.createAbortController(
            lastUserMessage?.id,
            true,
        );

        const { signal } = abortController;

        // 构建最终请求消息
        let reqMessages: ChatCompletionMessageParam[] = [];

        if (!systemMessage.content) {
            reqMessages = [...userMessages];
        } else {
            reqMessages = [
                {
                    role: 'system' as const,
                    content: robot.prompt || '',
                },
                ...userMessages,
            ];
        }

        reqMessages = processReqMessages(model, reqMessages);

        const processStream = async (stream: any) => {
            // 流式处理主要逻辑
            let content = '';
            let isFirstChunk = true;
            let time_first_token_millsec = 0;
            let thinkingContent = '';

            const reasoningTags = [
                { openingTag: '<think>', closingTag: '</think>', separator: '\n' },
                { openingTag: '###Thinking', closingTag: '###Response', separator: '\n' },
            ];

            const getAppropriateTag = (model: Model) => {
                if (model.id.includes('qwen3')) return reasoningTags[0];
                return reasoningTags[0];
            };

            const reasoningTag = getAppropriateTag(model);

            // 使用中间件处理推理内容
            const { stream: processedStream } = await extractReasoningMiddleware<OpenAIStreamChunk>(
                {
                    openingTag: reasoningTag?.openingTag,
                    closingTag: reasoningTag?.closingTag,
                    separator: reasoningTag?.separator,
                    // enableReasoning,
                },
            ).onMessage({
                doStream: async () => ({
                    stream: asyncGeneratorToReadableStream(
                        openAIChunkToTextDelta(stream, abortController),
                    ),
                }),
            });

            // 处理流式响应
            for await (const chunk of readableStreamAsyncIterable(processedStream)) {
                // 检查是否已被中止
                if (abortController?.signal.aborted) {
                    console.log('Stream processing aborted');
                    throw new DOMException('Request was aborted.', 'AbortError');
                }

                const typedChunk = chunk as OpenAIStreamChunk;

                switch (typedChunk.type) {
                    case 'reasoning': {
                        if (!time_first_token_millsec) {
                            time_first_token_millsec = new Date().getTime();
                        }

                        thinkingContent += typedChunk.textDelta;
                        // 处理推理/思考内容
                        onChunk({
                            type: ChunkType.THINKING_DELTA,
                            text: typedChunk.textDelta,
                            thinking_millsec: new Date().getTime() - time_first_token_millsec,
                        });
                        break;
                    }
                    case 'text-delta': {
                        let textDelta = typedChunk.textDelta;

                        if (isFirstChunk) {
                            isFirstChunk = false;

                            if (!time_first_token_millsec) {
                                time_first_token_millsec = new Date().getTime();
                            } else {
                                onChunk({
                                    type: ChunkType.THINKING_COMPLETE,
                                    text: thinkingContent,
                                    thinking_millsec:
                                        new Date().getTime() - time_first_token_millsec,
                                });
                            }
                        }

                        content += textDelta;
                        onChunk({ type: ChunkType.TEXT_DELTA, text: textDelta });
                        break;
                    }
                    case 'finish': {
                        // 处理完成事件
                        if (thinkingContent) {
                            onChunk({
                                type: ChunkType.THINKING_COMPLETE,
                                text: thinkingContent,
                            });
                        }
                        if (content) {
                            onChunk({ type: ChunkType.TEXT_COMPLETE, text: content });
                        }
                        // 发送流式处理完成信号
                        onChunk({ type: ChunkType.BLOCK_COMPLETE });
                        break;
                    }
                }
            }
            console.log('content', content);
        };

        onChunk({ type: ChunkType.LLM_RESPONSE_CREATED });
        // const start_time_millsec = new Date().getTime();

        // 传递 AbortController signal 给 OpenAI SDK
        const requestOptions: any = {
            model: model.id,
            messages: reqMessages,
            stream: true,
        };

        if (abortController) {
            requestOptions.signal = abortController.signal;
        }

        const stream = await this.sdk.chat.completions.create(requestOptions, {
            signal,
        });

        await processStream(stream).finally(cleanup);

        await signalPromise?.promise?.catch((error) => {
            throw error;
        });
    }
}
