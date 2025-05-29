import React, { memo, useMemo, useCallback } from 'react';
import { md } from '@/utils/markdownRenderer';
import DOMPurify from 'dompurify';
import CodeBlockView from '@/chat/components/CodeBlockView';

interface MessageRendererProps {
    content: string;
    isStreaming?: boolean;
}

interface ContentPart {
    type: 'text' | 'code' | 'math-block' | 'math-inline' | 'html';
    content: string;
    language?: string;
    id: string;
}

const MessageRenderer: React.FC<MessageRendererProps> = ({ content, isStreaming = false }) => {
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

    const parsedContent = useMemo(() => {
        if (!content) return [];

        const parts: ContentPart[] = [];
        let partIndex = 0;

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
        while ((match = codeBlockRegex.exec(content)) !== null) {
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
        while ((match = mathBlockRegex.exec(content)) !== null) {
            specialBlocks.push({
                type: 'math-block',
                content: match[1].trim(),
                start: match.index!,
                end: match.index! + match[0].length,
            });
        }

        // 3. 找到所有行内数学公式
        const mathInlineRegex = /\$([^\$\n]+)\$/g;
        while ((match = mathInlineRegex.exec(content)) !== null) {
            specialBlocks.push({
                type: 'math-inline',
                content: match[1].trim(),
                start: match.index!,
                end: match.index! + match[0].length,
            });
        }

        // 按位置排序
        specialBlocks.sort((a, b) => a.start - b.start);

        console.log('specialBlocks', specialBlocks);

        // 4. 分割内容
        let currentPos = 0;

        specialBlocks.forEach((block) => {
            // 添加特殊块前的文本内容
            if (block.start > currentPos) {
                const textContent = content.slice(currentPos, block.start);
                if (textContent.trim()) {
                    // 对文本内容进行 markdown 渲染
                    const renderedHtml = md.render(textContent);
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
        if (currentPos < content.length) {
            const textContent = content.slice(currentPos);
            if (textContent.trim()) {
                // 对文本内容进行 markdown 渲染
                const renderedHtml = md.render(textContent);
                parts.push({
                    type: 'html',
                    content: processHtmlContent(renderedHtml),
                    id: `html-${partIndex++}`,
                });
            }
        }

        return parts;
    }, [content, processHtmlContent]);

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
