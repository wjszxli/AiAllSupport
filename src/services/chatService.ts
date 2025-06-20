import { extractWebpageContent } from '../utils/webContentExtractor';
import { chatAIStream } from '@/services';
import { ChatMessage, ConfigModelType, IMessage } from '@/types';
import storage from '@/utils/storage';
import { t } from '../locales/i18n';
import React from 'react';
import { updateMessage } from '@/utils/messageUtils';
import { Logger } from '@/utils/logger';

// Create a logger for this module
const logger = new Logger('chatService');

/**
 * 向AI服务发送消息
 * @param {string} message - 要发送的消息
 * @param {(chunk: string) => void} onStreamUpdate - 用于增量更新的可选回调
 * @param {string | null} tabId - 标签页ID
 * @param {ConfigModelType} interfaceType - 界面类型，默认为聊天界面
 * @returns {Promise<string>} AI的响应
 */
export async function sendMessage(
    message: string,
    onStreamUpdate?: (response: string, thinking: string) => void,
    tabId?: string | null,
    interfaceType = ConfigModelType.CHAT,
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
            logger.debug('Sending data:', { messages: sendMessage });

            const onData = async (chunk: { data: string; done: boolean }) => {
                if (signal.aborted) {
                    return;
                }

                logger.debug('Received data chunk:', { chunk });
                const { data, done } = chunk;

                if (!done && !data.startsWith('data: ')) {
                    logger.debug('Adding direct text to response:', { data });
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
                        logger.debug('Parsing stream data:', { data });
                        const chunkStringData = data.slice(6);
                        const chunkData = JSON.parse(chunkStringData);
                        if (chunkData.choices?.[0]?.delta?.content) {
                            const content = chunkData.choices[0].delta.content;
                            logger.debug('Adding content to response:', { content });
                            messageText += content;
                            if (onStreamUpdate) onStreamUpdate(messageText, thinkingText);
                        } else if (chunkData.choices?.[0]?.delta?.reasoning_content) {
                            const reasoning_content = chunkData.choices[0].delta.reasoning_content;
                            logger.debug('Adding thinking to response:', { reasoning_content });
                            thinkingText += reasoning_content;
                            if (onStreamUpdate) onStreamUpdate(messageText, thinkingText);
                        } else {
                            logger.debug('No content in data chunk:', { chunkData });
                        }
                    } catch (error) {
                        logger.error('Error parsing data chunk:', { error });
                    }
                }

                if (done) {
                    logger.debug('Stream transmission complete. Final response:', { messageText });

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

            chatAIStream(sendMessage, onData, tabId, interfaceType).catch((error) => {
                logger.error('Error in chatAIStream:', { error });
                if (!signal.aborted) {
                    reject(error);
                }
            });
        });
    } catch (error) {
        logger.error('Error sending message:', { error });
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
        logger.debug('Calling sendMessageWithWebpageContext with content:', { userMessage });
        let contextMessage = userMessage;

        logger.debug('Extracting webpage content...');

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

        logger.debug('Extracted webpage content length:', { length: webpageContent.length });

        // 格式化消息与网页上下文
        contextMessage = `${t('webpageContent')}:${webpageContent}${t(
            'webpagePrompt',
        )}: ${userMessage}`;

        // 调用sendMessage发送消息
        logger.debug('Sending message with context, length:', { length: contextMessage.length });

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
        logger.error('Error sending message with webpage context:', { error });
        throw error;
    }
}
