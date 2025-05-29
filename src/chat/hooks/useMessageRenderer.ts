import { useCallback, useEffect } from 'react';
import { md } from '@/utils/markdownRenderer';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

export const useMessageRenderer = () => {
    // 初始化 Highlight.js
    useEffect(() => {
        // 初始化时自动高亮页面上的代码块
        hljs.highlightAll();
    }, []);

    // 处理代码块的语法高亮和行号
    const processCodeBlocks = useCallback((html: string): string => {
        // 使用正则表达式匹配代码块
        const codeBlockRegex = /<pre><code(?:\s+class="language-(\w+)")?>([^<]+)<\/code><\/pre>/g;
        return html.replace(codeBlockRegex, (_match, lang, code) => {
            // 解码 HTML 实体
            const decodedCode = code
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");

            // 获取语言显示名称
            const languageMap: { [key: string]: string } = {
                ts: 'TypeScript',
                js: 'JavaScript',
                jsx: 'React JSX',
                tsx: 'React TSX',
                py: 'Python',
                java: 'Java',
                cpp: 'C++',
                cs: 'C#',
                go: 'Go',
                rs: 'Rust',
                sql: 'SQL',
                json: 'JSON',
                yaml: 'YAML',
                md: 'Markdown',
                sh: 'Shell',
                bash: 'Bash',
                docker: 'Dockerfile',
                git: 'Git',
            };

            const displayLang = lang ? languageMap[lang] || lang.toUpperCase() : 'Plain Text';

            // 使用 highlight.js 高亮代码
            let highlightedCode;
            try {
                // 确保代码有正确的换行
                const codeWithLineBreaks = decodedCode.replace(/\r\n/g, '\n');

                highlightedCode = lang
                    ? hljs.highlight(codeWithLineBreaks, { language: lang }).value
                    : hljs.highlightAuto(codeWithLineBreaks).value;
            } catch (error) {
                // 如果指定的语言不支持，回退到自动检测
                highlightedCode = hljs.highlightAuto(decodedCode).value;
            }

            // 添加行号
            const lines = highlightedCode.split('\n');
            const lineCount = lines.length;

            // 构建行号和代码内容
            const numberedLines = lines
                .map((line, index) => {
                    const lineNumber = index + 1;
                    // 确保空行也有适当的高度
                    const lineContent = line || '&nbsp;';
                    return `<div class="code-line">
                        <div class="line-number" data-line-number="${lineNumber}"></div>
                        <div class="line-content"><span class="line-text">${lineContent}</span></div>
                    </div>`;
                })
                .join('');

            // 构建代码块容器
            return `
                <div class="code-block-wrapper">
                    <div class="code-block-header">
                        <div class="code-info">
                            <span class="code-language">${displayLang}</span>
                            <span class="code-lines">${lineCount} lines</span>
                        </div>
                        <div class="code-actions">
                            <button class="copy-code-button" data-code="${encodeURIComponent(
                                decodedCode,
                            )}">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                </svg>
                                <span>复制代码</span>
                            </button>
                        </div>
                    </div>
                    <div class="code-block-body">
                        <div class="code-content">
                            ${numberedLines}
                        </div>
                    </div>
                </div>
            `;
        });
    }, []);

    // 处理特殊字符和表情符号
    const processSpecialCharacters = useCallback((html: string): string => {
        // 使用正则表达式匹配 emoji 表情
        const emojiRegex = /(:[\w+-]+:)/g;
        return html.replace(emojiRegex, '<span class="emoji">$1</span>');
    }, []);

    // 处理数学公式
    const processMathExpressions = useCallback((html: string): string => {
        // 使用正则表达式匹配行内数学公式 $...$ 和行间数学公式 $$...$$
        const inlineMathRegex = /\$([^\$]+)\$/g;
        const blockMathRegex = /\$\$([^\$]+)\$\$/g;

        html = html.replace(inlineMathRegex, '<span class="math-inline">$1</span>');
        html = html.replace(blockMathRegex, '<div class="math-block">$1</div>');

        return html;
    }, []);

    // 处理链接
    const processLinks = useCallback((html: string): string => {
        const linkRegex = /<a\s+href="([^"]+)"([^>]*)>([^<]+)<\/a>/g;
        return html.replace(linkRegex, (_match, url, attrs, text) => {
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
    }, []);

    // 渲染消息内容
    const renderMessageContent = useCallback(
        (content: string, isStreaming: boolean = false): string => {
            if (!content) return '<div class="empty-content">暂无内容</div>';

            // 1. 首先使用 markdown 渲染器处理内容
            let html = md.render(content);

            // 2. 处理代码块
            html = processCodeBlocks(html);

            // 3. 处理特殊字符和表情
            html = processSpecialCharacters(html);

            // 4. 处理数学公式
            html = processMathExpressions(html);

            // 5. 处理链接
            html = processLinks(html);

            // 6. 净化 HTML 以防止 XSS 攻击
            html = DOMPurify.sanitize(html);

            // 7. 添加流式加载的样式类
            if (isStreaming) {
                html = `<div class="streaming">${html}</div>`;
            }

            return html;
        },
        [processCodeBlocks, processSpecialCharacters, processMathExpressions, processLinks],
    );

    return {
        renderMessageContent,
    };
};
