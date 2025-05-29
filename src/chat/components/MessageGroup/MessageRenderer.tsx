import React, { memo, useMemo, useCallback } from 'react';
import { md } from '@/utils/markdownRenderer';
import DOMPurify from 'dompurify';
import CodeBlockView from '@/chat/components/CodeBlockView';
import ThinkingView from '@/chat/components/CodeBlockView/ThinkingView';
import { useStore } from '@/store';
import {
    MessageBlockType,
    MessageBlockStatus,
    type MessageBlock,
    type ThinkingMessageBlock,
} from '@/types/messageBlock';

interface MessageRendererProps {
    content: string;
    messageId?: string;
    isStreaming?: boolean;
}

interface ContentPart {
    type: 'text' | 'code' | 'math-block' | 'math-inline' | 'html' | 'thinking';
    content: string;
    language?: string;
    thinking_millsec?: number;
    isStreaming?: boolean;
    id: string;
}

const MessageRenderer: React.FC<MessageRendererProps> = ({
    content,
    messageId,
    isStreaming = false,
}) => {
    const { messageBlockStore } = useStore();

    // 处理 HTML 内容（链接、表情等）
    const processHtmlContent = useCallback((html: string): string => {
        // 处理特殊字符和表情符号
        const emojiRegex = /(:[\w+-]+:)/g;
        html = html.replace(emojiRegex, '<span class="emoji">$1</span>');

        // 处理链接
        const linkRegex = /<a\s+href="([^"]+)"([^>]*)>([^<]+)<\/a>/g;
        html = html.replace(linkRegex, (_match, url, attrs, text) => {
            const isExternal = url.startsWith('http') || url.startsWith('https');
            const externalAttrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
            return `<a href="${url}"${attrs}${externalAttrs} class="message-link">
                ${text}
                ${
                    isExternal
                        ? '<svg viewBox="0 0 24 24" width="12" height="12" class="external-link-icon"><path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>'
                        : ''
                }
            </a>`;
        });

        return html;
    }, []);

    // 处理主文本内容的辅助函数
    const processMainTextContent = useCallback(
        (textContent: string, startIndex: number) => {
            console.log('processMainTextContent called with:', {
                textContentLength: textContent.length,
                textContentPreview: textContent.substring(0, 100),
                startIndex,
            });

            const parts: ContentPart[] = [];
            let partIndex = startIndex;

            // 创建一个数组来存储所有需要特殊处理的内容块
            interface SpecialBlock {
                type: 'code' | 'math-block' | 'math-inline';
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
                specialBlocks.push({
                    type: 'code',
                    content: match[2].trim(),
                    language: match[1] || '',
                    start: match.index!,
                    end: match.index! + match[0].length,
                });
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

            console.log('processMainTextContent special blocks found:', specialBlocks.length);

            // 4. 分割内容
            let currentPos = 0;

            specialBlocks.forEach((block) => {
                // 添加特殊块前的文本内容
                if (block.start > currentPos) {
                    const htmlContent = textContent.slice(currentPos, block.start);
                    console.log('Processing text before special block:', {
                        htmlContent: htmlContent.substring(0, 50),
                        htmlContentLength: htmlContent.length,
                        trimmed: htmlContent.trim().length,
                    });
                    if (htmlContent.trim()) {
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
            console.log('Processing final text content:', {
                currentPos,
                textContentLength: textContent.length,
                hasRemainingContent: currentPos < textContent.length,
            });

            if (currentPos < textContent.length) {
                const htmlContent = textContent.slice(currentPos);
                console.log('Final text content details:', {
                    htmlContent: htmlContent.substring(0, 100),
                    htmlContentLength: htmlContent.length,
                    trimmed: htmlContent.trim().length,
                });
                if (htmlContent.trim()) {
                    // 对文本内容进行 markdown 渲染
                    const renderedHtml = md.render(htmlContent);
                    console.log('Adding final HTML part:', {
                        renderedHtmlLength: renderedHtml.length,
                        renderedHtmlPreview: renderedHtml.substring(0, 100),
                    });
                    parts.push({
                        type: 'html',
                        content: processHtmlContent(renderedHtml),
                        id: `html-${partIndex++}`,
                    });
                } else {
                    console.log('Final text content is empty after trimming');
                }
            } else {
                console.log('No remaining text content to process');
            }

            console.log('processMainTextContent result:', {
                inputLength: textContent.length,
                outputParts: parts.length,
                partTypes: parts.map((part) => part.type),
            });

            return { parts, nextIndex: partIndex };
        },
        [processHtmlContent],
    );

    const parsedContent = useMemo(() => {
        const parts: ContentPart[] = [];
        let partIndex = 0;

        console.log('MessageRenderer Debug:', {
            messageId,
            content: content?.substring(0, 100) + (content?.length > 100 ? '...' : ''),
            contentLength: content?.length,
        });

        // 首先检查是否有 messageBlocks
        if (messageId) {
            const messageBlocks = messageBlockStore.getBlocksForMessage(messageId);
            console.log(
                'MessageBlocks found:',
                messageBlocks.map((block) => ({
                    id: block.id,
                    type: block.type,
                    status: block.status,
                    contentLength: 'content' in block ? block.content?.length : 0,
                })),
            );

            // 如果有任何块，就优先使用块而不是 content 参数
            if (messageBlocks.length > 0) {
                console.log('Using messageBlocks instead of content parameter');

                // 添加THINKING块
                const thinkingBlocks = messageBlocks.filter(
                    (block: MessageBlock) => block.type === MessageBlockType.THINKING,
                );
                thinkingBlocks.forEach((block: MessageBlock) => {
                    if (
                        block.type === MessageBlockType.THINKING &&
                        'content' in block &&
                        block.content
                    ) {
                        const thinkingBlock = block as ThinkingMessageBlock;
                        const isThinkingStreaming =
                            thinkingBlock.status === MessageBlockStatus.STREAMING;
                        console.log('Adding THINKING block:', {
                            id: thinkingBlock.id,
                            contentLength: thinkingBlock.content.length,
                            isStreaming: isThinkingStreaming,
                        });
                        parts.push({
                            type: 'thinking',
                            content: thinkingBlock.content,
                            thinking_millsec: thinkingBlock.thinking_millsec,
                            isStreaming: isThinkingStreaming,
                            id: `thinking-${thinkingBlock.id}`,
                        });
                    }
                });

                // 添加MAIN_TEXT块
                const textBlocks = messageBlocks.filter(
                    (block: MessageBlock) => block.type === MessageBlockType.MAIN_TEXT,
                );
                console.log('MAIN_TEXT blocks found:', textBlocks.length);

                if (textBlocks.length === 0) {
                    console.log(
                        'No MAIN_TEXT blocks found - this might be why response content is not showing',
                    );
                } else {
                    console.log(
                        'MAIN_TEXT blocks details:',
                        textBlocks.map((block) => ({
                            id: block.id,
                            type: block.type,
                            status: block.status,
                            hasContent: 'content' in block,
                            contentLength: 'content' in block ? block.content?.length : 0,
                            contentPreview:
                                'content' in block ? block.content?.substring(0, 50) : 'N/A',
                        })),
                    );
                }

                textBlocks.forEach((block: MessageBlock) => {
                    console.log('Processing MAIN_TEXT block:', block.id);
                    if (
                        block.type === MessageBlockType.MAIN_TEXT &&
                        'content' in block &&
                        block.content
                    ) {
                        const textContent = block.content;
                        console.log('MAIN_TEXT block content details:', {
                            id: block.id,
                            contentLength: textContent.length,
                            preview: textContent.substring(0, 100),
                            fullContent: textContent, // 临时显示完整内容以便调试
                        });

                        const processedContent = processMainTextContent(textContent, partIndex);
                        console.log('processMainTextContent result:', {
                            inputLength: textContent.length,
                            outputParts: processedContent.parts.length,
                            partsDetails: processedContent.parts.map((part) => ({
                                type: part.type,
                                id: part.id,
                                contentLength: part.content?.length,
                            })),
                        });

                        parts.push(...processedContent.parts);
                        partIndex = processedContent.nextIndex;
                    } else {
                        console.log('MAIN_TEXT block skipped:', {
                            id: block.id,
                            hasContent: 'content' in block,
                            contentExists: 'content' in block ? !!block.content : false,
                            contentLength: 'content' in block ? block.content?.length : 0,
                        });
                    }
                });

                // 添加其他类型的块（如 CODE 块）
                const otherBlocks = messageBlocks.filter(
                    (block: MessageBlock) =>
                        block.type !== MessageBlockType.THINKING &&
                        block.type !== MessageBlockType.MAIN_TEXT,
                );
                otherBlocks.forEach((block: MessageBlock) => {
                    if ('content' in block && block.content) {
                        // 根据块类型处理内容
                        if (block.type === MessageBlockType.CODE) {
                            parts.push({
                                type: 'code',
                                content: block.content,
                                language: 'language' in block ? (block as any).language : '',
                                id: `code-${block.id}`,
                            });
                        }
                        // 可以在这里添加其他块类型的处理
                    }
                });

                console.log('Final parts from messageBlocks:', parts.length);

                // 如果没有任何文本内容部分（只有思考块），但有 content 参数，使用 content 作为补充
                const hasTextContent = parts.some(
                    (part) =>
                        part.type === 'html' ||
                        part.type === 'code' ||
                        part.type === 'math-block' ||
                        part.type === 'math-inline',
                );

                if (!hasTextContent && content && content.trim()) {
                    console.log(
                        'No text content in messageBlocks, using content parameter as fallback',
                    );
                    // 清理 content 中的思考标签（因为思考内容已经通过 THINKING 块显示了）
                    let cleanContent = content;
                    cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/g, '');
                    cleanContent = cleanContent.replace(
                        /###\s*Thinking[\s\S]*?###\s*Response\s*/gi,
                        '',
                    );
                    cleanContent = cleanContent.replace(/##\s*思考过程[\s\S]*?##\s*回答\s*/gi, '');
                    cleanContent = cleanContent.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
                    cleanContent = cleanContent.trim();

                    if (cleanContent) {
                        console.log('Adding fallback content from content parameter:', {
                            originalLength: content.length,
                            cleanedLength: cleanContent.length,
                            preview: cleanContent.substring(0, 100),
                        });
                        const processedContent = processMainTextContent(cleanContent, partIndex);
                        parts.push(...processedContent.parts);
                    }
                }

                return parts;
            }
        }

        // 如果没有MAIN_TEXT块但有content，处理传入的content作为fallback
        // 注意：此时需要确保content中不包含thinking标签内容
        if (content) {
            console.log(
                'Using fallback content processing, original content length:',
                content.length,
            );
            // 移除可能的thinking标签内容，因为thinking应该通过THINKING块显示
            let cleanContent = content;

            // 移除 <think>...</think> 标签及其内容
            cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/g, '');

            // 移除其他可能的thinking标签格式
            cleanContent = cleanContent.replace(/###\s*Thinking[\s\S]*?###\s*Response\s*/gi, '');
            cleanContent = cleanContent.replace(/##\s*思考过程[\s\S]*?##\s*回答\s*/gi, '');

            // 移除OpenAI style reasoning标签
            cleanContent = cleanContent.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');

            // 去除多余的空白
            cleanContent = cleanContent.trim();

            console.log('Cleaned content for fallback:', {
                originalLength: content.length,
                cleanedLength: cleanContent.length,
                preview: cleanContent.substring(0, 100),
            });

            if (cleanContent) {
                const processedContent = processMainTextContent(cleanContent, partIndex);
                parts.push(...processedContent.parts);
                console.log('Added fallback content parts:', processedContent.parts.length);
            } else {
                console.log('No clean content after processing, skipping fallback');
            }
        } else {
            console.log('No content parameter provided for fallback');
        }

        console.log(
            'Final parsed parts:',
            parts.map((part) => ({
                type: part.type,
                id: part.id,
                contentLength: part.content?.length,
            })),
        );

        return parts;
    }, [content, messageId, messageBlockStore, processMainTextContent]);

    console.log('content', content);
    console.log('parsedContent', parsedContent);

    return (
        <div className={`message-content-renderer ${isStreaming ? 'streaming' : ''}`}>
            {parsedContent.map((part) => {
                switch (part.type) {
                    case 'html':
                        return (
                            <div
                                key={part.id}
                                dangerouslySetInnerHTML={{
                                    __html: DOMPurify.sanitize(part.content),
                                }}
                            />
                        );

                    case 'code':
                        return (
                            <CodeBlockView key={part.id} language={part.language || ''}>
                                {part.content}
                            </CodeBlockView>
                        );

                    case 'thinking':
                        return (
                            <ThinkingView
                                key={part.id}
                                thinking_millsec={part.thinking_millsec}
                                isStreaming={part.isStreaming}
                            >
                                {part.content}
                            </ThinkingView>
                        );

                    case 'math-block':
                        return (
                            <div key={part.id} className="math-block">
                                {part.content}
                            </div>
                        );

                    case 'math-inline':
                        return (
                            <span key={part.id} className="math-inline">
                                {part.content}
                            </span>
                        );

                    default:
                        return null;
                }
            })}
        </div>
    );
};

export default memo(MessageRenderer);
