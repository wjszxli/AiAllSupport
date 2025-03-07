import type { ChatMessage, SearchResult } from '@/typings';
import { t } from './i18n';
import React from 'react';
import { updateMessage } from '@/utils/messageUtils';
import { SEARCH_COUNT } from '@/utils/constant';

// 检查扩展API是否可用
const isExtensionApiAvailable = (): boolean => {
    return (
        typeof window !== 'undefined' && typeof (window as any).DeepSeekExtension !== 'undefined'
    );
};

// 搜索服务，获取搜索结果
export async function performSearch(query: string): Promise<SearchResult[]> {
    try {
        console.log('Performing search for:', query);

        // 检查是否在扩展环境中
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            try {
                console.log('Using Chrome extension background script for search');

                // 使用Promise封装chrome.runtime.sendMessage调用
                const response: { success: boolean; results: SearchResult[] } = await new Promise(
                    (resolve, reject) => {
                        chrome.runtime.sendMessage(
                            { action: 'performSearch', query },
                            (response) => {
                                if (chrome.runtime.lastError) {
                                    reject(chrome.runtime.lastError);
                                    return;
                                }

                                // 确保我们收到了预期的响应格式
                                if (response && typeof response === 'object') {
                                    resolve(response);
                                } else {
                                    reject(
                                        new Error(
                                            'Unexpected response format from background script',
                                        ),
                                    );
                                }
                            },
                        );
                    },
                );

                if (response.success && response.results) {
                    console.log('Background search results:', response.results);
                    return response.results;
                } else {
                    throw new Error('Background search failed');
                }
            } catch (error) {
                console.error('Background script search failed:', error);
                // 搜索失败返回空结果
                return [];
            }
        }

        // 如果扩展API可用，尝试使用扩展API
        if (isExtensionApiAvailable()) {
            try {
                console.log('Using extension API for search');
                const results = await (window as any).DeepSeekExtension.performSearch(query);
                console.log('Extension search results:', results);
                return results;
            } catch (error) {
                console.error('Extension API search failed:', error);
                // 搜索失败返回空结果
                return [];
            }
        }

        // 所有方法都失败，返回空结果
        console.error('All search methods failed');
        return [];
    } catch (error) {
        console.error('Search failed:', error);
        return [];
    }
}

// 抓取网页内容 - 获取每个网页的内容
export async function fetchWebContent(url: string): Promise<string> {
    try {
        console.log('Fetching content from URL:', url);

        // 检查是否在扩展环境中
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            try {
                console.log('Using Chrome extension background script for fetching web content');

                // 使用Promise封装chrome.runtime.sendMessage调用
                const response: {
                    success: boolean;
                    content: string;
                } = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({ action: 'fetchWebContent', url }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                            return;
                        }

                        // 确保我们收到了预期的响应格式
                        if (response && typeof response === 'object') {
                            resolve(response);
                        } else {
                            reject(new Error('Unexpected response format from background script'));
                        }
                    });
                });

                if (response.success) {
                    console.log('Background fetched content length:', response.content.length);

                    return response.content;
                } else {
                    throw new Error('Background web content fetch failed');
                }
            } catch (error) {
                console.error('Background script web content fetch failed:', error);
                // 如果后台获取失败，继续尝试扩展API
            }
        }

        // 如果扩展API可用，使用扩展API
        if (isExtensionApiAvailable()) {
            try {
                console.log('Using extension API for web content');
                const result = await (window as any).DeepSeekExtension.fetchWebContent(url);
                console.log('Extension fetched content length:', result.content?.length || 0);
                return result.content || '';
            } catch (error) {
                console.error('Extension API content fetch failed:', error);
                // 所有方法都失败
                return '';
            }
        }

        // 所有方法都失败
        console.error('All web content fetch methods failed');
        return '';
    } catch (error) {
        console.error('Failed to fetch content:', error);
        return '';
    }
}

export async function localFetchWebContentWithContext(
    messageId: number,
    inputMessage: string,
    enhancedMessage: string,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
): Promise<string> {
    const searchingMessage: ChatMessage = {
        id: messageId,
        text: t('searchingWeb' as any),
        sender: 'system',
    };

    updateMessage(setMessages, messageId, searchingMessage);

    const searchResults = await performSearch(inputMessage);
    console.log('searchResults', searchResults);

    if (searchResults.length > 0) {
        // 查询结果存在，获取网页内容
        const contents = await Promise.all(
            searchResults.slice(0, SEARCH_COUNT).map((result) => fetchWebContent(result.link)),
        );

        console.log('contents', contents);

        // const referenceContent = `\`\`\`json\n${JSON.stringify(webSearchReferences, null, 2)}\n\`\`\``
        // const value = REFERENCE_PROMPT.replace('{question}', message.content).replace('{references}', referenceContent)

        // 构建咨询的问题
        const webContext = `${t('webSearchResultsTips1')}:${contents
            .map(
                (content, i) =>
                    `${t('Source')} ${i + 1}: ${searchResults[i].title}\n${content.substring(
                        0,
                        1500,
                    )}\n`,
            )
            .join('\n')}${t('webSearchResultsTips2')}: ${inputMessage}`;

        enhancedMessage = webContext;

        // 更新咨询的问题
        const searchCompleteMessage: ChatMessage = {
            id: messageId,
            text: t('searchComplete' as any),
            sender: 'system',
        };

        updateMessage(setMessages, messageId, searchCompleteMessage);
    } else {
        const noResultsMessage: ChatMessage = {
            id: messageId,
            text: t('noSearchResults' as any),
            sender: 'system',
        };

        updateMessage(setMessages, messageId, noResultsMessage);
    }

    return enhancedMessage;
}
