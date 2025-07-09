import { useCallback } from 'react';
import { message as AntdMessage } from 'antd';
import robotStore from '@/store/robot';
import llmStore from '@/store/llm';
import rootStore from '@/store';
import { InputMessage, getUserMessage } from '@/utils/message/input';
import { getMessageService } from '@/services/MessageService';
import { getSearchService } from '@/services/SearchService';
import { ConfigModelType, Robot } from '@/types';
import { Logger } from '@/utils/logger';
import { t } from '@/locales/i18n';

const logger = new Logger('useMessageSender');

export const useMessageSender = () => {
    const handleSendMessage = useCallback(
        async ({
            userInput,
            robot,
            onSuccess,
            interfaceType = ConfigModelType.CHAT,
        }: {
            userInput: string;
            robot?: Robot;
            onSuccess?: () => void;
            interfaceType?: ConfigModelType;
        }) => {
            if (!userInput.trim()) return;

            const selectedRobot = robot || robotStore?.selectedRobot;
            logger.info('robot', selectedRobot);
            const { selectedTopicId } = selectedRobot;

            if (!selectedTopicId) {
                AntdMessage.error('请先选择一个话题');
                return;
            }

            // 使用指定界面类型的模型
            selectedRobot.model = llmStore.getModelForType(interfaceType);
            logger.debug(`Using ${interfaceType} model:`, selectedRobot.model);

            const topic = selectedRobot.topics.find((topic) => topic.id === selectedTopicId);

            if (!topic) {
                AntdMessage.error('请先选择一个话题');
                return;
            }

            let finalUserInput = userInput;

            // 检查是否需要执行搜索
            const searchService = getSearchService(rootStore);
            const settings = rootStore.settingStore;

            if (settings.webSearchEnabled) {
                const modelSupportsSearch = searchService.modelSupportsNativeSearch(
                    selectedRobot.model?.id,
                );

                if (!modelSupportsSearch) {
                    try {
                        logger.info('Performing web search before sending message');
                        AntdMessage.loading('正在搜索相关信息...', 0);

                        const searchResponse = await searchService.performSearch(userInput);
                        const searchResults = searchService.formatSearchResults(searchResponse);

                        if (searchResults) {
                            // 获取引用提示词模板
                            const referencePrompt =
                                t('REFERENCE_PROMPT') ||
                                `请基于参考资料回答问题。

## 标注规则：
- 请在适当的地方在句子最后标注上下文来源。
- 请使用 [数字] 的格式来引用答案中对应的部分。
- 如果一句话源于多个上下文，请列出所有相关的引用编号，例如 [1][2]。记住不要把引用都集中在最后，要在答案的对应部分列出。

## 我的问题是：

{question}

## 参考资料：

{references}

请用与用户问题相同的语言回答。`;

                            // 将搜索结果和用户问题组合
                            finalUserInput = referencePrompt
                                .replace('{question}', userInput)
                                .replace('{references}', searchResults);

                            logger.info('Search completed, enhanced message with search results');
                        }

                        AntdMessage.destroy(); // 清除loading消息
                    } catch (error) {
                        logger.error('Search failed:', error);
                        AntdMessage.destroy(); // 清除loading消息
                        AntdMessage.warning('搜索失败，将直接发送消息');
                        // 搜索失败不影响正常发送消息
                    }
                } else {
                    logger.info('Model supports native search, skipping external search');
                }
            }

            // 获取网页上下文（如果启用）
            if (settings.useWebpageContext && !settings.webSearchEnabled) {
                try {
                    // 获取当前页面的内容
                    const pageContent = await getCurrentPageContent();
                    if (pageContent) {
                        const webpagePrompt =
                            t('webpagePrompt') ||
                            `请基于当前网页内容回答问题。

## 当前网页内容：

{content}

## 用户问题：

{question}

请用与用户问题相同的语言回答。`;

                        finalUserInput = webpagePrompt
                            .replace('{content}', pageContent)
                            .replace('{question}', userInput);
                    }
                } catch (error) {
                    logger.error('Failed to get webpage content:', error);
                    // 获取网页内容失败不影响正常发送消息
                }
            }

            const userMessage: InputMessage = {
                robot: selectedRobot,
                topic: topic,
                content: finalUserInput,
            };

            const { message, blocks } = getUserMessage(userMessage);

            const messageService = getMessageService(rootStore);
            messageService.sendMessage(message, blocks, selectedRobot, selectedTopicId);

            // 调用成功回调
            if (onSuccess) {
                onSuccess();
            }
        },
        [],
    );

    return {
        handleSendMessage,
    };
};

/**
 * 获取当前页面内容
 */
async function getCurrentPageContent(): Promise<string | null> {
    try {
        // 这里需要通过Chrome扩展API获取页面内容
        // 由于这是一个扩展环境，我们需要使用chrome.tabs API
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.id) {
            return null;
        }

        // 注入脚本获取页面内容
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                // 获取页面主要文本内容
                const content = document.body.innerText || document.body.textContent || '';
                // 限制内容长度，避免过长
                return content.slice(0, 5000);
            },
        });

        return results[0]?.result || null;
    } catch (error) {
        console.error('Failed to get current page content:', error);
        return null;
    }
}
