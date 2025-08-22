import { ConfigModelType } from '@/types';
import rootStore from '@/store';
import { getMessageService } from './MessageService';
import { getUserMessage } from '@/utils/message/input';

export interface PageContent {
    title: string;
    url: string;
    content: string;
    timestamp: number;
}

export interface SummaryOptions {
    language?: string;
    maxLength?: number;
    includeKeyPoints?: boolean;
    includeStructure?: boolean;
}

export class PageSummaryService {
    private static instance: PageSummaryService;
    private messageService = getMessageService(rootStore);

    public static getInstance(): PageSummaryService {
        if (!PageSummaryService.instance) {
            PageSummaryService.instance = new PageSummaryService();
        }
        return PageSummaryService.instance;
    }

    /**
     * 提取页面内容
     */
    public async extractPageContent(): Promise<PageContent | null> {
        try {
            // 获取页面基本信息
            const title = document.title || 'Untitled Page';
            const url = window.location.href;
            const timestamp = Date.now();

            // 获取页面主要内容
            let content = '';

            // 尝试从常见的内容容器中提取文本
            const contentSelectors = [
                'main',
                'article',
                '[role="main"]',
                '.content',
                '.main-content',
                '.post-content',
                '.article-content',
                '.entry-content',
                '#content',
                '#main',
                '.container',
            ];

            let contentElement: Element | null = null;
            for (const selector of contentSelectors) {
                contentElement = document.querySelector(selector);
                if (contentElement && this.hasSignificantContent(contentElement)) {
                    break;
                }
            }

            // 如果没有找到特定的内容容器，使用body但过滤掉导航等元素
            if (!contentElement) {
                contentElement = document.body;
            }

            if (contentElement) {
                content = this.extractTextContent(contentElement);
            }

            // 如果内容太少，可能提取失败
            if (content.length < 100) {
                throw new Error('页面内容太少，无法生成有效总结');
            }

            return { title, url, content, timestamp };
        } catch (error) {
            console.error('Failed to extract page content:', error);
            throw new Error(
                '无法提取页面内容：' + (error instanceof Error ? error.message : String(error)),
            );
        }
    }

    /**
     * 生成页面总结
     */
    public async generateSummary(
        pageContent: PageContent,
        options: SummaryOptions = {},
    ): Promise<string> {
        try {
            const robot = rootStore.llmStore.getRobotForType(ConfigModelType.SIDEBAR);
            if (!robot) {
                throw new Error('未配置侧边栏机器人，请在设置中配置模型');
            }

            const selectedTopicId = robot.selectedTopicId;
            if (!selectedTopicId) {
                throw new Error('机器人未选择话题，请检查配置');
            }

            // 构建总结提示词
            const prompt = this.buildSummaryPrompt(pageContent, options);

            // 创建用户消息
            const userMessage = getUserMessage({
                robot,
                topic: robot.topics.find((t) => t.id === selectedTopicId)!,
                content: prompt,
            });

            // 发送消息
            this.messageService.sendMessage(
                userMessage.message,
                userMessage.blocks,
                robot,
                selectedTopicId,
            );

            // 等待响应完成
            return new Promise((resolve, reject) => {
                let isResolved = false;
                let checkCount = 0;
                const maxChecks = 120; // 最多检查120次（2分钟）

                const checkForCompletion = () => {
                    if (isResolved || checkCount >= maxChecks) {
                        if (!isResolved && checkCount >= maxChecks) {
                            reject(new Error('总结生成超时，请稍后重试'));
                        }
                        return;
                    }

                    checkCount++;

                    try {
                        const messages =
                            rootStore.messageStore.getMessagesForTopic(selectedTopicId);
                        const latestMessage = messages[messages.length - 1];
                        const currentStreamingId = rootStore.messageStore.streamingMessageId;

                        // 检查是否有AI回复且流式传输已完成
                        if (
                            latestMessage &&
                            latestMessage.role === 'assistant' &&
                            !currentStreamingId
                        ) {
                            const blocks = latestMessage.blocks
                                ?.map((blockId) =>
                                    rootStore.messageBlockStore.getBlockById(blockId),
                                )
                                .filter(Boolean);

                            if (blocks && blocks.length > 0) {
                                const content = blocks
                                    .filter((block) => block && 'content' in block)
                                    .map((block) => (block as any).content || '')
                                    .join('');

                                if (content.trim()) {
                                    isResolved = true;
                                    resolve(content);
                                    return;
                                }
                            }
                        }

                        // 继续检查
                        setTimeout(checkForCompletion, 1000);
                    } catch (error) {
                        console.error('Error checking for completion:', error);
                        setTimeout(checkForCompletion, 1000);
                    }
                };

                // 开始检查
                setTimeout(checkForCompletion, 2000); // 2秒后开始检查，给消息发送一些时间
            });
        } catch (error) {
            console.error('Failed to generate summary:', error);
            throw new Error(
                '生成总结失败：' + (error instanceof Error ? error.message : String(error)),
            );
        }
    }

    /**
     * 检查元素是否包含有意义的内容
     */
    private hasSignificantContent(element: Element): boolean {
        const text = element.textContent || '';
        const cleanText = text.replace(/\s+/g, ' ').trim();

        // 至少要有100个字符，并且不能全是重复内容
        if (cleanText.length < 100) return false;

        // 检查是否有太多重复的短语（可能是导航菜单等）
        const words = cleanText.split(' ');
        const uniqueWords = new Set(words);
        const uniqueRatio = uniqueWords.size / words.length;

        return uniqueRatio > 0.3; // 至少30%的词汇是独特的
    }

    /**
     * 提取文本内容
     */
    private extractTextContent(element: Element): string {
        // 克隆元素以避免修改原始DOM
        const clonedElement = element.cloneNode(true) as Element;

        // 移除不需要的元素
        const elementsToRemove = [
            'script',
            'style',
            'nav',
            'header',
            'footer',
            'aside',
            '.sidebar',
            '.menu',
            '.navigation',
            '.nav',
            '.breadcrumb',
            '.ads',
            '.advertisement',
            '.banner',
            '.popup',
            '.modal',
            '.overlay',
            '.comments',
            '.comment',
            '.social-share',
            '.share-buttons',
            '.related-posts',
            '.tags',
            '.metadata',
            '[role="navigation"]',
            '[role="banner"]',
            '[role="contentinfo"]',
            '[role="complementary"]',
            '[aria-hidden="true"]',
        ];

        elementsToRemove.forEach((selector) => {
            const elements = clonedElement.querySelectorAll(selector);
            elements.forEach((el) => el.remove());
        });

        // 提取文本内容，保留一些结构
        let content = '';
        const walker = document.createTreeWalker(
            clonedElement,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.textContent?.trim();
                        return text && text.length > 2
                            ? NodeFilter.FILTER_ACCEPT
                            : NodeFilter.FILTER_REJECT;
                    }

                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as Element;
                        const tagName = element.tagName.toLowerCase();

                        // 跳过某些元素
                        if (['script', 'style', 'noscript'].includes(tagName)) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        return NodeFilter.FILTER_ACCEPT;
                    }

                    return NodeFilter.FILTER_REJECT;
                },
            },
        );

        let node;
        let lastElementType = '';

        while ((node = walker.nextNode())) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent?.trim();
                if (text && text.length > 2) {
                    content += text + ' ';
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                const tagName = element.tagName.toLowerCase();

                // 在标题和段落之间添加换行
                if (
                    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'section', 'article'].includes(
                        tagName,
                    )
                ) {
                    if (lastElementType && lastElementType !== tagName) {
                        content += '\n';
                    }
                    lastElementType = tagName;
                }
            }
        }

        // 清理文本：移除多余的空白字符
        content = content
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .replace(/\n\s+/g, '\n')
            .trim();

        // 限制内容长度（避免过长的内容影响性能）
        if (content.length > 15000) {
            content = content.substring(0, 15000) + '...';
        }

        return content;
    }

    /**
     * 构建总结提示词
     */
    private buildSummaryPrompt(pageContent: PageContent, options: SummaryOptions): string {
        const {
            language = '中文',
            maxLength = 800,
            includeKeyPoints = true,
            includeStructure = true,
        } = options;

        let prompt = `请总结以下网页内容，要求：

1. 使用${language}回答
2. 总结长度控制在${maxLength}字以内
3. 保持客观和准确，不添加个人观点
4. 提取最重要的信息和核心观点`;

        if (includeKeyPoints) {
            prompt += '\n5. 突出关键点和要点';
        }

        if (includeStructure) {
            prompt += '\n6. 使用清晰的结构组织内容（如使用标题、列表等）';
        }

        prompt += `

网页信息：
标题：${pageContent.title}
地址：${pageContent.url}

网页内容：
${pageContent.content}

请提供详细的总结：`;

        return prompt;
    }

    /**
     * 清理和格式化总结内容
     */
    public formatSummary(rawSummary: string): string {
        return rawSummary
            .trim()
            .replace(/\n{3,}/g, '\n\n') // 移除过多的换行
            .replace(/\s{2,}/g, ' ') // 移除过多的空格
            .replace(/^#+\s*/gm, '### ') // 统一标题格式
            .trim();
    }
}

export const pageSummaryService = PageSummaryService.getInstance();
