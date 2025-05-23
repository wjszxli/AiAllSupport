import { isEmpty } from 'lodash';
import { OpenAIStreamChunk } from './OpenAiLlmProvider';

export interface ExtractReasoningMiddlewareOptions {
    openingTag: string;
    closingTag: string;
    separator?: string;
    enableReasoning?: boolean;
}

function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

export function getPotentialStartIndex(text: string, searchedText: string): number | null {
    // Return null immediately if searchedText is empty.
    if (searchedText.length === 0) {
        return null;
    }

    // Check if the searchedText exists as a direct substring of text.
    const directIndex = text.indexOf(searchedText);
    if (directIndex !== -1) {
        return directIndex;
    }

    // Otherwise, look for the largest suffix of "text" that matches
    // a prefix of "searchedText". We go from the end of text inward.
    for (let i = text.length - 1; i >= 0; i--) {
        const suffix = text.substring(i);
        if (searchedText.startsWith(suffix)) {
            return i;
        }
    }

    return null;
}

export function asyncGeneratorToReadableStream<T>(gen: AsyncGenerator<T>): ReadableStream<T> {
    return new ReadableStream<T>({
        async pull(controller) {
            const { value, done } = await gen.next();
            if (done) {
                controller.close();
            } else {
                controller.enqueue(value);
            }
        },
    });
}

export async function* openAIChunkToTextDelta(stream: any): AsyncGenerator<OpenAIStreamChunk> {
    for await (const chunk of stream) {
        // if (window.keyv.get(EVENT_NAMES.CHAT_COMPLETION_PAUSED)) {
        //     break;
        // }

        const delta = chunk.choices[0]?.delta;
        if (delta?.reasoning_content || delta?.reasoning) {
            yield { type: 'reasoning', textDelta: delta.reasoning_content || delta.reasoning };
        }
        if (delta?.content) {
            yield { type: 'text-delta', textDelta: delta.content };
        }
        if (delta?.tool_calls) {
            yield { type: 'tool-calls', delta: delta };
        }

        const finishReason = chunk.choices[0]?.finish_reason;
        if (!isEmpty(finishReason)) {
            yield { type: 'finish', finishReason, usage: chunk.usage, delta, chunk };
            break;
        }
    }
}

export function extractReasoningMiddleware<
    T extends { type: string } = { type: string; textDelta: string },
>({
    openingTag,
    closingTag,
    separator = '\n',
    enableReasoning,
}: ExtractReasoningMiddlewareOptions) {
    const openingTagEscaped = escapeRegExp(openingTag);
    const closingTagEscaped = escapeRegExp(closingTag);

    return {
        onMessage: async ({
            doStream,
        }: {
            doStream: () => Promise<{ stream: ReadableStream<T> } & Record<string, any>>;
        }) => {
            const { stream, rest } = await doStream();
            if (!enableReasoning) {
                return {
                    stream,
                    ...rest,
                };
            }
            let firstReasoning = true;
            let firstText = true;
            let afterSwitch = false;
            let isReasoning = false;
            let buffer = '';
            return {
                stream: stream.pipeThrough(
                    new TransformStream<T, T>({
                        transform: (chunk, controller) => {
                            if (chunk.type !== 'text-delta') {
                                controller.enqueue(chunk);
                                return;
                            }
                            // @ts-ignore
                            buffer += chunk.textDelta;
                            function publish(text: string) {
                                if (text.length > 0) {
                                    const prefix =
                                        afterSwitch && (isReasoning ? !firstReasoning : !firstText)
                                            ? separator
                                            : '';
                                    controller.enqueue({
                                        ...chunk,
                                        type: isReasoning ? 'reasoning' : 'text-delta',
                                        textDelta: prefix + text,
                                    });
                                    afterSwitch = false;
                                    if (isReasoning) {
                                        firstReasoning = false;
                                    } else {
                                        firstText = false;
                                    }
                                }
                            }
                            while (true) {
                                const nextTag = isReasoning ? closingTagEscaped : openingTagEscaped;
                                const startIndex = getPotentialStartIndex(buffer, nextTag);
                                if (startIndex == null) {
                                    publish(buffer);
                                    buffer = '';
                                    break;
                                }
                                publish(buffer.slice(0, startIndex));
                                const foundFullMatch = startIndex + nextTag.length <= buffer.length;
                                if (foundFullMatch) {
                                    buffer = buffer.slice(startIndex + nextTag.length);
                                    isReasoning = !isReasoning;
                                    afterSwitch = true;
                                } else {
                                    buffer = buffer.slice(startIndex);
                                    break;
                                }
                            }
                        },
                    }),
                ),
                ...rest,
            };
        },
    };
}

export function readableStreamAsyncIterable<T>(stream: ReadableStream<T>): AsyncIterable<T> {
    const reader = stream.getReader();
    return {
        [Symbol.asyncIterator](): AsyncIterator<T> {
            return {
                async next(): Promise<IteratorResult<T>> {
                    return reader.read() as Promise<IteratorResult<T>>;
                },
            };
        },
    };
}
