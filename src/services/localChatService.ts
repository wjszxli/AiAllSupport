import type { ChatMessage, SearchResult } from '@/types';
import { t } from '@/locales/i18n';
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
export const performSearch = async (query: string): Promise<SearchResult[]> => {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            // 方式1: 使用Chrome扩展背景脚本
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'performSearch',
                    query: query,
                });

                if (response && response.results) {
                    return response.results;
                }
            } catch (error) {
                console.error('Background script search failed:', error);
            }

            // 方式2: 直接使用扩展API (如果可用)
            try {
                if (isExtensionApiAvailable()) {
                    const results = await (window as any).DeepSeekExtension.performSearch(query);
                    return results;
                }
            } catch (error) {
                console.error('Extension API search failed:', error);
            }
        }

        // 所有方法都失败了
        console.error('All search methods failed');
        return [];
    } catch (error) {
        console.error('Search failed:', error);
        return [];
    }
};

// 定义网页内容的格式
export interface WebContent {
    id: number;
    content: string;
    sourceUrl: string;
    type: 'url';
}

// 抓取网页内容 - 获取每个网页的内容，返回原始字符串
export const fetchWebContent = async (url: string): Promise<string> => {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            // 方式1: 使用Chrome扩展背景脚本
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'fetchWebContent',
                    url: url,
                });

                if (response && response.content) {
                    return response.content;
                }
            } catch (error) {
                console.error('Background script web content fetch failed:', error);
            }

            // 方式2: 直接使用扩展API (如果可用)
            try {
                if (isExtensionApiAvailable()) {
                    const result = await (window as any).DeepSeekExtension.fetchWebContent(url);
                    return result.content || '';
                }
            } catch (error) {
                console.error('Extension API content fetch failed:', error);
            }
        }

        // 所有方法都失败了
        console.error('All web content fetch methods failed');
        return '';
    } catch (error) {
        console.error('Failed to fetch content:', error);
        return '';
    }
};

// 将获取的网页内容转换为特定格式
export function formatWebContent(content: string, url: string, id: number): WebContent {
    return {
        id,
        content,
        sourceUrl: url,
        type: 'url',
    };
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

        // 转换为请求的格式
        const formattedContents = contents.map((content, index) =>
            formatWebContent(content, searchResults[index].link, index + 1),
        );

        console.log('formattedContents', formattedContents);

        // 创建一个Web内容引用的JSON格式
        const webReferences = JSON.stringify(formattedContents, null, 2);

        // 为AI模型准备引用内容
        const referenceContent = `\`\`\`json\n${webReferences}\n\`\`\``;
        const promptForAI = t('REFERENCE_PROMPT')
            .replace('{question}', inputMessage)
            .replace('{references}', referenceContent);

        // 更新系统消息，显示已完成搜索
        const searchCompleteMessage: ChatMessage = {
            id: messageId,
            text: t('searchComplete' as any),
            sender: 'system',
        };

        updateMessage(setMessages, messageId, searchCompleteMessage);
        return promptForAI;
    }

    // 没有结果
    const noResultsMessage: ChatMessage = {
        id: messageId,
        text: t('noSearchResults' as any),
        sender: 'system',
    };

    updateMessage(setMessages, messageId, noResultsMessage);

    return enhancedMessage; // 没有搜索结果，返回原始增强消息
}
