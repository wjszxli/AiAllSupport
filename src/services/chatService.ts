import { extractWebpageContent } from '../utils/webContentExtractor';
import { chatAIStream } from '@/services';
import type { ChatMessage, IMessage } from '@/typings';
import storage from '@/utils/storage';
import { t } from './i18n';
import React from 'react';
import { updateMessage } from '@/utils/messageUtils';

/**
 * Sends a message to the AI service
 * @param {string} message - The message to send
 * @param {(chunk: string) => void} onStreamUpdate - Optional callback for incremental updates
 * @returns {Promise<string>} The response from the AI
 */
export async function sendMessage(
    message: string,
    onStreamUpdate?: (chunk: string) => void,
): Promise<string> {
    try {
        console.log('sendMessage called with:', message);
        const previousMessages: IMessage[] = (await storage.get('chatHistory')) || [];
        const sendMessage = [...previousMessages, { role: 'user', content: message }];
        console.log('Chat history with new message:', sendMessage);

        let response = '';

        // @ts-ignore
        window.currentAbortController = new AbortController();
        // @ts-ignore
        const signal = window.currentAbortController.signal;

        return new Promise((resolve, reject) => {
            // Check if chatAIStream accepts signal parameter
            // If not, we need to adjust how we call it
            chatAIStream(sendMessage, async (chunk) => {
                // If request was aborted, stop processing
                if (signal.aborted) {
                    return;
                }

                console.log('Received chunk:', chunk);
                const { data, done } = chunk;

                // Process direct text content
                if (!done && !data.startsWith('data: ')) {
                    console.log('Adding direct text to response:', data);
                    response += data;
                    if (onStreamUpdate) onStreamUpdate(data);
                }
                // Process streaming data
                else if (!done) {
                    try {
                        console.log('Parsing stream data:', data);
                        const chunkStringData = data.slice(6); // Remove "data: " prefix
                        const chunkData = JSON.parse(chunkStringData);
                        if (chunkData.choices?.[0]?.delta?.content) {
                            const content = chunkData.choices[0].delta.content;
                            console.log('Adding content to response:', content);
                            response += content;
                            if (onStreamUpdate) onStreamUpdate(content);
                        } else {
                            console.log('No content in chunk data:', chunkData);
                        }
                    } catch (error) {
                        console.error('Error parsing chunk data:', error);
                    }
                }

                // Handle completion
                if (done) {
                    console.log('Stream complete. Final response:', response);

                    // Update chat history with the completed response
                    const updatedMessages = [
                        ...sendMessage,
                        { role: 'assistant', content: response },
                    ];
                    await storage.set('chatHistory', updatedMessages);

                    // @ts-ignore
                    window.currentAbortController = null;

                    resolve(response);
                }
            }).catch((error) => {
                console.error('Error in chatAIStream:', error);
                // Only reject if not aborted
                if (!signal.aborted) {
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error('Error in sendMessage:', error);
        throw error;
    }
}

/**
 * Sends a message to the LLM with the current webpage context
 * @param {string} userMessage - The user's message
 * @param {boolean} includeWebpage - Whether to include the webpage content
 * @param {(chunk: string) => void} onStreamUpdate - Optional callback for incremental updates
 * @returns {Promise<string>} The response from the LLM
 */
export async function sendMessageWithWebpageContext(
    messageId: number,
    userMessage: string,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
): Promise<string> {
    try {
        console.log('sendMessageWithWebpageContext called with:', userMessage);
        let contextMessage = userMessage;

        console.log('Extracting webpage content...');

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

        console.log('Extracted webpage content length:', webpageContent.length);

        // 格式化消息与网页上下文
        contextMessage = `${t('webpageContent')}:${webpageContent}${t(
            'webpagePrompt',
        )}: ${userMessage}`;

        // 调用sendMessage发送消息
        console.log('Sending message with context of length:', contextMessage.length);

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
        console.error('Error sending message with webpage context:', error);
        throw error;
    }
}
