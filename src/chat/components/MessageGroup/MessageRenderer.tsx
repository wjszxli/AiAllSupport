import React, { useMemo, useCallback } from 'react';
import { md } from '@/utils/markdownRenderer';
import DOMPurify from 'dompurify';
import CodeBlockView from '@/chat/components/Blocks/Code';
import MermaidView from '@/chat/components/Blocks/Mermaid';
import ThinkingView from '@/chat/components/Blocks/Think';
import InterruptedView from '@/chat/components/Blocks/Interrupted';
import { useStore } from '@/store';
import { observer } from 'mobx-react-lite';
import {
    MessageBlockType,
    type MessageBlock,
    type ThinkingMessageBlock,
    type InterruptedMessageBlock,
    ErrorMessageBlock,
} from '@/types/messageBlock';
import ErrorBlock from '@/chat/components/Blocks/Error';

interface MessageRendererProps {
    content: string;
    messageId?: string;
    isStreaming?: boolean;
    thinkingContent?: string;
    errorContent?: string;
}

interface ContentPart {
    type:
        | 'text'
        | 'code'
        | 'math-block'
        | 'math-inline'
        | 'html'
        | 'thinking'
        | 'mermaid'
        | 'error'
        | 'interrupted';
    content?: string;
    language?: string;
    thinking_millsec?: number;
    isStreaming?: boolean;
    thinkingBlock?: ThinkingMessageBlock;
    interruptedBlock?: InterruptedMessageBlock;
    error?: Record<string, any>;
    id: string;
    forceCollapsed?: boolean;
}

const MessageRenderer: React.FC<MessageRendererProps> = observer(
    ({ content, messageId, thinkingContent, isStreaming = false, errorContent }) => {
        const { messageBlockStore } = useStore();

        // 在 useMemo 外部获取 messageBlocks，让 MobX 正确观察到变化
        const messageBlocks = messageId ? messageBlockStore.getBlocksForMessage(messageId) : [];

        // 处理 HTML 内容（链接、表情等）
        const processHtmlContent = useCallback((html: string): string => {
            // 处理特殊字符和表情符号
            const emojiRegex = /(:[\w+-]+:)/g;
            html = html.replace(emojiRegex, '<span class="emoji">$1</span>');

            // 处理链接
            const linkRegex = /<a\s+href="([^"]+)"([^>]*)>([^<]+)<\/a>/g;
            html = html.replace(linkRegex, (_match, url, attrs, text) => {
                const isExternal = url.startsWith('http') || url.startsWith('https');
                const externalAttrs = isExternal
                    ? ' target="_blank" rel="noopener noreferrer"'
                    : '';
                return `<a href="${url}"${attrs}${externalAttrs} class="message-link">
                ${text}
                ${
                    isExternal
                        ? '<svg viewBox="0 0 24 24" width="12" height="12" class="external-link-icon"><path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>'
                        : ''
                }
            </a>`;
            });

            // 处理表格，添加wrapper以支持横向滚动
            const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
            html = html.replace(tableRegex, (match) => {
                return `<div class="table-wrapper">${match}</div>`;
            });

            return html;
        }, []);

        // 处理主文本内容的辅助函数
        const processMainTextContent = useCallback(
            (textContent: string, startIndex: number) => {
                const parts: ContentPart[] = [];
                let partIndex = startIndex;

                // 创建一个数组来存储所有需要特殊处理的内容块
                interface SpecialBlock {
                    type: 'code' | 'math-block' | 'math-inline' | 'mermaid';
                    content: string;
                    language?: string;
                    start: number;
                    end: number;
                }

                const specialBlocks: SpecialBlock[] = [];

                // 1. 找到所有代码块
                const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
                let match;
                while ((match = codeBlockRegex.exec(textContent)) !== null) {
                    const language = match[1] || '';
                    const content = match[2].trim();

                    // 检查是否是 mermaid 图表
                    if (language.toLowerCase() === 'mermaid') {
                        specialBlocks.push({
                            type: 'mermaid',
                            content: content,
                            language: language,
                            start: match.index!,
                            end: match.index! + match[0].length,
                        });
                    } else {
                        specialBlocks.push({
                            type: 'code',
                            content: content,
                            language: language,
                            start: match.index!,
                            end: match.index! + match[0].length,
                        });
                    }
                }

                // 2. 找到所有数学公式块
                const mathBlockRegex = /\$\$([\s\S]*?)\$\$/g;
                while ((match = mathBlockRegex.exec(textContent)) !== null) {
                    specialBlocks.push({
                        type: 'math-block',
                        content: match[1].trim(),
                        start: match.index!,
                        end: match.index! + match[0].length,
                    });
                }

                // 3. 找到所有行内数学公式
                const mathInlineRegex = /\$([^\$\n]+)\$/g;
                while ((match = mathInlineRegex.exec(textContent)) !== null) {
                    specialBlocks.push({
                        type: 'math-inline',
                        content: match[1].trim(),
                        start: match.index!,
                        end: match.index! + match[0].length,
                    });
                }

                // 按位置排序
                specialBlocks.sort((a, b) => a.start - b.start);

                // 4. 分割内容
                let currentPos = 0;

                specialBlocks.forEach((block) => {
                    // 添加特殊块前的文本内容
                    if (block.start > currentPos) {
                        const htmlContent = textContent.slice(currentPos, block.start);
                        if (
                            htmlContent.length > 0 &&
                            (htmlContent.trim() || htmlContent.includes('\n'))
                        ) {
                            // 对文本内容进行 markdown 渲染
                            const renderedHtml = md.render(htmlContent);
                            parts.push({
                                type: 'html',
                                content: processHtmlContent(renderedHtml),
                                id: `html-${partIndex++}`,
                            });
                        }
                    }

                    // 添加特殊块
                    if (block.type === 'code') {
                        parts.push({
                            type: 'code',
                            content: block.content,
                            language: block.language,
                            id: `code-${partIndex++}`,
                        });
                    } else if (block.type === 'mermaid') {
                        parts.push({
                            type: 'mermaid',
                            content: block.content,
                            language: block.language,
                            id: `mermaid-${partIndex++}`,
                        });
                    } else if (block.type === 'math-block') {
                        parts.push({
                            type: 'math-block',
                            content: block.content,
                            id: `math-block-${partIndex++}`,
                        });
                    } else if (block.type === 'math-inline') {
                        parts.push({
                            type: 'math-inline',
                            content: block.content,
                            id: `math-inline-${partIndex++}`,
                        });
                    }

                    currentPos = block.end;
                });

                // 添加最后的文本内容
                if (currentPos < textContent.length) {
                    const htmlContent = textContent.slice(currentPos);
                    if (
                        htmlContent.length > 0 &&
                        (htmlContent.trim() || htmlContent.includes('\n'))
                    ) {
                        // 对文本内容进行 markdown 渲染
                        const renderedHtml = md.render(htmlContent);
                        parts.push({
                            type: 'html',
                            content: processHtmlContent(renderedHtml),
                            id: `html-${partIndex++}`,
                        });
                    }
                }

                return { parts, nextIndex: partIndex };
            },
            [processHtmlContent],
        );

        const parsedContent = useMemo(() => {
            const parts: ContentPart[] = [];
            let partIndex = 0;

            // 首先检查是否有 messageBlocks
            if (messageId && messageBlocks.length > 0) {
                // 检查是否有中断块
                const hasInterruptedBlock = messageBlocks.some(
                    (block: MessageBlock) => block.type === MessageBlockType.INTERRUPTED,
                );

                // 添加THINKING块 - 如果存在中断块，折叠思考块
                const thinkingBlocks = messageBlocks.filter(
                    (block: MessageBlock) => block.type === MessageBlockType.THINKING,
                );

                thinkingBlocks.forEach((block: MessageBlock) => {
                    if (block.type === MessageBlockType.THINKING && 'content' in block) {
                        const thinkingBlock = block as ThinkingMessageBlock;
                        // 传递完整的 thinking block 给 ThinkingView，让它内部自主判断状态
                        parts.push({
                            type: 'thinking',
                            thinkingBlock: thinkingBlock,
                            id: `thinking-${thinkingBlock.id}`,
                            // 如果存在中断块，强制折叠思考块
                            forceCollapsed: hasInterruptedBlock,
                        });
                    }
                });

                // 添加INTERRUPTED块 - 总是显示在思考块之后
                const interruptedBlocks = messageBlocks.filter(
                    (block: MessageBlock) => block.type === MessageBlockType.INTERRUPTED,
                );

                interruptedBlocks.forEach((block: MessageBlock) => {
                    if (block.type === MessageBlockType.INTERRUPTED) {
                        const interruptedBlock = block as InterruptedMessageBlock;
                        parts.push({
                            type: 'interrupted',
                            interruptedBlock: interruptedBlock,
                            id: `interrupted-${interruptedBlock.id}`,
                        });
                    }
                });

                // 添加ERROR块
                const errorBlocks = messageBlocks.filter(
                    (block: MessageBlock) => block.type === MessageBlockType.ERROR,
                );
                errorBlocks.forEach((block: MessageBlock) => {
                    if (block.type === MessageBlockType.ERROR) {
                        const errorBlock = block as ErrorMessageBlock;
                        parts.push({
                            type: 'error',
                            error: errorBlock.error,
                            id: `error-${errorBlock.id}`,
                        });
                    }
                });

                // 添加MAIN_TEXT块
                const textBlocks = messageBlocks.filter(
                    (block: MessageBlock) => block.type === MessageBlockType.MAIN_TEXT,
                );

                if (textBlocks.length === 0) {
                    // 如果没有任何文本内容部分（只有思考块），但有 content 参数，使用 content 作为补充
                    const hasTextContent = parts.some(
                        (part) =>
                            part.type === 'html' ||
                            part.type === 'code' ||
                            part.type === 'math-block' ||
                            part.type === 'math-inline',
                    );

                    if (!hasTextContent && content && content.trim()) {
                        // 清理 content 中的思考标签（因为思考内容已经通过 THINKING 块显示了）
                        let cleanContent = content;
                        cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/g, '');
                        cleanContent = cleanContent.replace(
                            /###\s*Thinking[\s\S]*?###\s*Response\s*/gi,
                            '',
                        );
                        cleanContent = cleanContent.replace(
                            /##\s*思考过程[\s\S]*?##\s*回答\s*/gi,
                            '',
                        );
                        cleanContent = cleanContent.replace(
                            /<reasoning>[\s\S]*?<\/reasoning>/gi,
                            '',
                        );
                        cleanContent = cleanContent.trim();

                        if (cleanContent) {
                            const processedContent = processMainTextContent(
                                cleanContent,
                                partIndex,
                            );
                            parts.push(...processedContent.parts);
                        }
                    }
                } else {
                    textBlocks.forEach((block: MessageBlock) => {
                        if (
                            block.type === MessageBlockType.MAIN_TEXT &&
                            'content' in block &&
                            block.content
                        ) {
                            const textContent = block.content;

                            const processedContent = processMainTextContent(textContent, partIndex);

                            parts.push(...processedContent.parts);
                            partIndex = processedContent.nextIndex;
                        }
                    });

                    // 添加其他类型的块（如 CODE 块、ERROR 块）
                    const otherBlocks = messageBlocks.filter(
                        (block: MessageBlock) =>
                            block.type !== MessageBlockType.THINKING &&
                            block.type !== MessageBlockType.MAIN_TEXT &&
                            block.type !== MessageBlockType.INTERRUPTED,
                    );
                    otherBlocks.forEach((block: MessageBlock) => {
                        if (
                            block.type === MessageBlockType.CODE &&
                            'content' in block &&
                            block.content
                        ) {
                            parts.push({
                                type: 'code',
                                content: block.content,
                                language: 'language' in block ? (block as any).language : '',
                                id: `code-${block.id}`,
                            });
                        } else if (
                            block.type === MessageBlockType.ERROR &&
                            'error' in block &&
                            block.error
                        ) {
                            parts.push({
                                type: 'error',
                                error: block.error,
                                id: `error-${block.id}`,
                            });
                        }
                        // 可以在这里添加其他块类型的处理
                    });

                    // 如果没有任何文本内容部分（只有思考块），但有 content 参数，使用 content 作为补充
                    const hasTextContent = parts.some(
                        (part) =>
                            part.type === 'html' ||
                            part.type === 'code' ||
                            part.type === 'math-block' ||
                            part.type === 'math-inline',
                    );

                    if (!hasTextContent && content && content.trim()) {
                        // 清理 content 中的思考标签（因为思考内容已经通过 THINKING 块显示了）
                        let cleanContent = content;
                        cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/g, '');
                        cleanContent = cleanContent.replace(
                            /###\s*Thinking[\s\S]*?###\s*Response\s*/gi,
                            '',
                        );
                        cleanContent = cleanContent.replace(
                            /##\s*思考过程[\s\S]*?##\s*回答\s*/gi,
                            '',
                        );
                        cleanContent = cleanContent.replace(
                            /<reasoning>[\s\S]*?<\/reasoning>/gi,
                            '',
                        );
                        cleanContent = cleanContent.trim();

                        if (cleanContent) {
                            const processedContent = processMainTextContent(
                                cleanContent,
                                partIndex,
                            );
                            parts.push(...processedContent.parts);
                        }
                    }
                }
            } else if (content) {
                // 如果没有MAIN_TEXT块但有content，处理传入的content作为fallback
                // 注意：此时需要确保content中不包含thinking标签内容

                // 移除可能的thinking标签内容，因为thinking应该通过THINKING块显示
                let cleanContent = content;

                // 移除 <think>...</think> 标签及其内容
                cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/g, '');

                // 移除其他可能的thinking标签格式
                cleanContent = cleanContent.replace(
                    /###\s*Thinking[\s\S]*?###\s*Response\s*/gi,
                    '',
                );
                cleanContent = cleanContent.replace(/##\s*思考过程[\s\S]*?##\s*回答\s*/gi, '');

                // 移除OpenAI style reasoning标签
                cleanContent = cleanContent.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');

                // 去除多余的空白
                cleanContent = cleanContent.trim();

                if (cleanContent) {
                    const processedContent = processMainTextContent(cleanContent, partIndex);
                    parts.push(...processedContent.parts);
                }
            }

            return parts;
        }, [
            content,
            messageId,
            processMainTextContent,
            isStreaming,
            messageBlocks,
            // 添加思考块内容变化的监听，确保流式更新时能重新计算
            ...messageBlocks
                .filter((block) => block.type === MessageBlockType.THINKING)
                .map((block) => ('content' in block ? block.content : '')),
            // 添加思考块状态变化的监听
            ...messageBlocks
                .filter((block) => block.type === MessageBlockType.THINKING)
                .map((block) => block.status),
            thinkingContent,
            errorContent,
        ]);

        console.log('parsedContent', parsedContent);
        console.log('errorContent', errorContent);

        return (
            <div className={`message-content-renderer ${isStreaming ? 'streaming' : ''}`}>
                {parsedContent.map((part) => {
                    switch (part.type) {
                        case 'html':
                            return (
                                <div
                                    key={part.id}
                                    className="markdown-content"
                                    dangerouslySetInnerHTML={{
                                        __html: DOMPurify.sanitize(part.content || ''),
                                    }}
                                />
                            );

                        case 'code':
                            return (
                                <CodeBlockView key={part.id} language={part.language || ''}>
                                    {part.content || ''}
                                </CodeBlockView>
                            );

                        case 'thinking':
                            return part.thinkingBlock ? (
                                <ThinkingView
                                    key={part.id}
                                    thinkingBlock={part.thinkingBlock}
                                    forceCollapsed={part.forceCollapsed}
                                />
                            ) : null;

                        case 'interrupted':
                            return part.interruptedBlock ? (
                                <InterruptedView
                                    key={part.id}
                                    content={part.interruptedBlock.content}
                                />
                            ) : null;

                        case 'math-block':
                            return (
                                <div key={part.id} className="math-block">
                                    {part.content || ''}
                                </div>
                            );

                        case 'math-inline':
                            return (
                                <span key={part.id} className="math-inline">
                                    {part.content || ''}
                                </span>
                            );

                        case 'mermaid':
                            return <MermaidView key={part.id}>{part.content || ''}</MermaidView>;
                        case 'error':
                            return <ErrorBlock part={part as ErrorMessageBlock} />;

                        default:
                            return null;
                    }
                })}
            </div>
        );
    },
);

export default MessageRenderer;
