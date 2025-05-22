import { extractWebpageContent } from '../utils/webContentExtractor';
import { chatAIStream } from '@/services';
import type { ChatMessage, IMessage } from '@/types';
import storage from '@/utils/storage';
import { t } from './i18n';
import React from 'react';
import { updateMessage } from '@/utils/messageUtils';

/**
 * 向AI服务发送消息
 * @param {string} message - 要发送的消息
 * @param {(chunk: string) => void} onStreamUpdate - 用于增量更新的可选回调
 * @returns {Promise<string>} AI的响应
 */
export async function sendMessage(
    message: string,
    onStreamUpdate?: (response: string, thinking: string) => void,
    tabId?: string | null,
): Promise<string> {
    try {
        const previousMessages: IMessage[] = (await storage.get('chatHistory')) || [];
        const sendMessage = [...previousMessages, { role: 'user', content: message }];

        let messageText = '';
        let thinkingText = '';

        let isInThinkStartTag = false;
        let isInThinkEndTag = false;
        // @ts-ignore
        window.currentAbortController = new AbortController();
        // @ts-ignore
        const signal = window.currentAbortController.signal;

        return new Promise((resolve, reject) => {
            console.log('发送数据：', sendMessage);

            const onData = async (chunk: { data: string; done: boolean }) => {
                if (signal.aborted) {
                    return;
                }

                console.log('收到数据块:', chunk);
                const { data, done } = chunk;

                if (!done && !data.startsWith('data: ')) {
                    console.log('添加直接文本到响应:', data);
                    // 思考结束后，开始收集响应
                    if (data.includes('<think>')) {
                        isInThinkStartTag = true;
                    } else if (data.includes('</think>')) {
                        isInThinkEndTag = true;
                    } else if (isInThinkStartTag && !isInThinkEndTag) {
                        thinkingText += data;
                    } else {
                        // Fix: Always append data that's not thinking text to messageText
                        messageText += data;
                    }

                    if (onStreamUpdate) onStreamUpdate(messageText, thinkingText);
                } else if (!done) {
                    try {
                        console.log('解析流数据:', data);
                        const chunkStringData = data.slice(6);
                        const chunkData = JSON.parse(chunkStringData);
                        if (chunkData.choices?.[0]?.delta?.content) {
                            const content = chunkData.choices[0].delta.content;
                            console.log('添加内容到响应:', content);
                            messageText += content;
                            if (onStreamUpdate) onStreamUpdate(messageText, thinkingText);
                        } else if (chunkData.choices?.[0]?.delta?.reasoning_content) {
                            const reasoning_content = chunkData.choices[0].delta.reasoning_content;
                            console.log('添加思考到响应:', reasoning_content);
                            thinkingText += reasoning_content;
                            if (onStreamUpdate) onStreamUpdate(messageText, thinkingText);
                        } else {
                            console.log('数据块中没有内容:', chunkData);
                        }
                    } catch (error) {
                        console.error('解析数据块时出错:', error);
                    }
                }

                if (done) {
                    console.log('流传输完成。最终响应:', messageText);

                    const updatedMessages = [
                        ...sendMessage,
                        { role: 'assistant', content: messageText },
                    ];
                    await storage.set('chatHistory', updatedMessages);

                    // @ts-ignore
                    window.currentAbortController = null;

                    resolve(messageText);
                }
            };

            chatAIStream(sendMessage, onData, tabId).catch((error) => {
                console.error('chatAIStream中出错:', error);
                if (!signal.aborted) {
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error('发送消息时出错:', error);
        throw error;
    }
}

/**
 * 向LLM发送带有当前网页上下文的消息
 * @param {string} userMessage - 用户的消息
 * @param {boolean} includeWebpage - 是否包含网页内容
 * @param {(chunk: string) => void} onStreamUpdate - 用于增量更新的可选回调
 * @returns {Promise<string>} 来自LLM的响应
 */
export async function sendMessageWithWebpageContext(
    messageId: number,
    userMessage: string,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
): Promise<string> {
    try {
        console.log('使用以下内容调用sendMessageWithWebpageContext:', userMessage);
        let contextMessage = userMessage;

        console.log('正在提取网页内容...');

        const fetchCurrentWebpage: ChatMessage = {
            id: messageId,
            text: t('fetchWebpageContent' as any),
            sender: 'system',
        };

        updateMessage(setMessages, messageId, fetchCurrentWebpage);

        const webpageContent = await extractWebpageContent();

        const fetchCurrentWebpageSuccess: ChatMessage = {
            id: messageId,
            text: t('fetchWebpageContentSuccess' as any),
            sender: 'system',
        };

        updateMessage(setMessages, messageId, fetchCurrentWebpageSuccess);

        console.log('提取的网页内容长度:', webpageContent.length);

        // 格式化消息与网页上下文
        contextMessage = `${t('webpageContent')}:${webpageContent}${t(
            'webpagePrompt',
        )}: ${userMessage}`;

        // 调用sendMessage发送消息
        console.log('正在发送带有上下文的消息，长度:', contextMessage.length);

        return contextMessage;
    } catch (error) {
        const fetchWebpageContentFailed: ChatMessage = {
            id: messageId,
            text: t('fetchWebpageContentFailed' as any),
            sender: 'system',
        };

        setMessages((prev) => {
            const existingMessage = prev.find((msg) => msg.id === messageId);
            if (existingMessage) {
                return prev.map((msg) => (msg.id === messageId ? fetchWebpageContentFailed : msg));
            }
            return [...prev, fetchWebpageContentFailed];
        });
        console.error('发送带有网页上下文的消息时出错:', error);
        throw error;
    }
}
