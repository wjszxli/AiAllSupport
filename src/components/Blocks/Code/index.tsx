import React, { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { message } from 'antd';
import { CopyOutlined, EyeOutlined, CodeOutlined, DownloadOutlined } from '@ant-design/icons';
import hljs from 'highlight.js';
import { t } from '@/locales/i18n';
import { Logger } from '@/utils/logger';

// Create a logger for this module
const logger = new Logger('CodeBlockView');
import './index.scss';

interface Props {
    children: string;
    language: string;
    onSave?: (newContent: string) => void;
}

/**
 * 代码块视图组件
 * 提供代码高亮、复制、下载等功能
 */
const CodeBlockView: React.FC<Props> = ({ children, language, onSave }) => {
    const [viewMode, setViewMode] = useState<'source' | 'preview'>('source');
    const [isHovered, setIsHovered] = useState(false);

    // 计算代码行数和行号
    const codeLines = useMemo(() => {
        const lines = children.split('\n');
        // 如果最后一行是空的，不计入行数
        return lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
    }, [children]);

    const lineNumbers = useMemo(() => {
        return Array.from({ length: codeLines.length }, (_, i) => i + 1);
    }, [codeLines.length]);

    // 计算行号列的宽度（根据最大行号的位数）
    const lineNumberWidth = useMemo(() => {
        const maxLineNumber = codeLines.length;
        const digits = maxLineNumber.toString().length;

        // 根据位数精确计算宽度
        if (digits === 1) return 32; // 1-9行: 32px
        if (digits === 2) return 40; // 10-99行: 40px
        if (digits === 3) return 48; // 100-999行: 48px
        if (digits === 4) return 56; // 1000-9999行: 56px

        // 超过4位数的情况，动态计算
        return 32 + (digits - 1) * 8;
    }, [codeLines.length]);

    // 移动端行号宽度（稍微紧凑一些）
    const mobileLineNumberWidth = useMemo(() => {
        const maxLineNumber = codeLines.length;
        const digits = maxLineNumber.toString().length;

        // 移动端更紧凑的计算
        if (digits === 1) return 28; // 1-9行: 28px
        if (digits === 2) return 34; // 10-99行: 34px
        if (digits === 3) return 40; // 100-999行: 40px
        if (digits === 4) return 46; // 1000-9999行: 46px

        // 超过4位数的情况，动态计算
        return 28 + (digits - 1) * 6;
    }, [codeLines.length]);

    // 初始化代码高亮
    useEffect(() => {
        const codeElements = document.querySelectorAll('.code-block pre code');
        codeElements.forEach((element) => {
            if (element instanceof HTMLElement && !element.classList.contains('hljs')) {
                hljs.highlightElement(element);
            }
        });
    }, [children, language]);

    // 处理复制代码
    const handleCopySource = useCallback(() => {
        navigator.clipboard.writeText(children).then(
            () => {
                message.success(t('copy_success') || '复制成功');
            },
            (err) => {
                logger.error('Copy failed:', err);
                message.error(t('copy_failed') || '复制失败');
            },
        );
    }, [children]);

    // 处理下载代码
    const handleDownloadSource = useCallback(() => {
        const fileName = `code_${Date.now()}.${language || 'txt'}`;
        const blob = new Blob([children], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        message.success(t('download_success') || '下载成功');
    }, [children, language]);

    // 获取语言显示名称
    const getLanguageDisplay = (lang: string): string => {
        const languageMap: Record<string, string> = {
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
            html: 'HTML',
            css: 'CSS',
            scss: 'SCSS',
        };
        return languageMap[lang] || lang?.toUpperCase() || 'Plain Text';
    };

    return (
        <div
            className="code-block"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="code-header">
                <div className="code-info">
                    <span className="code-language">{getLanguageDisplay(language)}</span>
                    <span className="code-lines">{codeLines.length} lines</span>
                </div>
                <div className={`code-toolbar ${isHovered ? 'show' : ''}`}>
                    <button
                        className="toolbar-button"
                        onClick={handleCopySource}
                        title={t('copy') || '复制'}
                    >
                        <CopyOutlined />
                    </button>
                    <button
                        className="toolbar-button"
                        onClick={handleDownloadSource}
                        title={t('download') || '下载'}
                    >
                        <DownloadOutlined />
                    </button>
                    {onSave && (
                        <button
                            className="toolbar-button"
                            onClick={() =>
                                setViewMode(viewMode === 'source' ? 'preview' : 'source')
                            }
                            title={
                                viewMode === 'source' ? t('preview') || '预览' : t('edit') || '编辑'
                            }
                        >
                            {viewMode === 'source' ? <EyeOutlined /> : <CodeOutlined />}
                        </button>
                    )}
                </div>
            </div>
            <div className="code-content">
                <div className="code-container">
                    <div
                        className="line-numbers"
                        style={
                            {
                                'minWidth': `${lineNumberWidth}px`,
                                '--mobile-width': `${mobileLineNumberWidth}px`,
                            } as React.CSSProperties
                        }
                    >
                        {lineNumbers.map((lineNum) => (
                            <span key={lineNum} className="line-number">
                                {lineNum}
                            </span>
                        ))}
                    </div>
                    <div className="code-main">
                        <pre>
                            <code className={`language-${language}`}>{children}</code>
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(CodeBlockView);
