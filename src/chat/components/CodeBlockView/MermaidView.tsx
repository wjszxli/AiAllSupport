import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mermaid from 'mermaid';
import './MermaidView.scss';

interface MermaidViewProps {
    children: string;
}

// 初始化 mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
    },
    sequence: {
        useMaxWidth: true,
    },
    gantt: {
        useMaxWidth: true,
    },
    journey: {
        useMaxWidth: true,
    },
    gitGraph: {
        useMaxWidth: true,
    },
});

const MermaidView: React.FC<MermaidViewProps> = ({ children }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRenderedContent, setLastRenderedContent] = useState<string>('');

    // 根据内容生成唯一的图表ID，确保内容变化时ID也变化
    const diagramId = useMemo(() => {
        const contentHash =
            children.trim().length > 0
                ? btoa(encodeURIComponent(children.trim())).slice(0, 16)
                : 'empty';
        return `mermaid-${Date.now()}-${contentHash}`;
    }, [children]);

    // 检查内容是否看起来像完整的 mermaid 代码
    const isContentComplete = useCallback((content: string): boolean => {
        const trimmed = content.trim();
        if (!trimmed) return false;

        // 检查是否有基本的 mermaid 语法结构
        const mermaidPatterns = [
            /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|journey|gantt|pie|gitgraph|erDiagram|userJourney|requirement|c4Context|mindmap|timeline|sankey|xychart|block-beta)/i,
        ];

        return mermaidPatterns.some((pattern) => pattern.test(trimmed));
    }, []);

    // 清理 mermaid 缓存
    const clearMermaidCache = useCallback(() => {
        try {
            // 清理可能存在的 DOM 元素
            const existingElements = document.querySelectorAll(`#${diagramId}`);
            existingElements.forEach((el) => el.remove());

            // 如果 mermaid 有清理缓存的方法，调用它
            if (typeof (mermaid as any).clearCache === 'function') {
                (mermaid as any).clearCache();
            }
        } catch (error) {
            console.warn('Failed to clear mermaid cache:', error);
        }
    }, [diagramId]);

    const renderMermaid = useCallback(async () => {
        const content = children.trim();

        if (!containerRef.current || !content) {
            setIsLoading(false);
            return;
        }

        // 如果内容没有变化，不重复渲染
        if (content === lastRenderedContent) {
            setIsLoading(false);
            return;
        }

        // 检查内容是否完整
        if (!isContentComplete(content)) {
            // 内容不完整时显示加载状态，但不尝试渲染
            setIsLoading(true);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // 清理旧的渲染结果和缓存
            clearMermaidCache();
            containerRef.current.innerHTML = '';

            // 验证 mermaid 语法
            try {
                await mermaid.parse(content);
            } catch (parseError) {
                throw new Error(
                    `Syntax error: ${
                        parseError instanceof Error ? parseError.message : 'Invalid syntax'
                    }`,
                );
            }

            // 渲染图表
            const { svg } = await mermaid.render(diagramId, content);

            if (containerRef.current) {
                containerRef.current.innerHTML = svg;

                // 添加样式优化
                const svgElement = containerRef.current.querySelector('svg');
                if (svgElement) {
                    svgElement.style.maxWidth = '100%';
                    svgElement.style.height = 'auto';
                    // 移除可能的固定宽高
                    svgElement.removeAttribute('width');
                    svgElement.removeAttribute('height');
                }

                // 更新最后渲染的内容
                setLastRenderedContent(content);
            }

            setIsLoading(false);
        } catch (err) {
            console.error('Mermaid rendering error:', err);
            setError(err instanceof Error ? err.message : 'Failed to render diagram');
            setIsLoading(false);

            // 显示错误信息和原始代码
            if (containerRef.current) {
                containerRef.current.innerHTML = `
                    <div class="mermaid-error">
                        <div class="error-message">
                            <strong>Mermaid rendering error:</strong> ${
                                err instanceof Error ? err.message : 'Unknown error'
                            }
                        </div>
                        <div class="error-code">
                            <pre><code>${content}</code></pre>
                        </div>
                    </div>
                `;
            }
        }
    }, [children, diagramId, lastRenderedContent, isContentComplete, clearMermaidCache]);

    const copyToClipboard = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(children);

            // 显示复制成功的反馈
            if (window.messageNotification?.success) {
                window.messageNotification.success('已复制 Mermaid 代码');
            }
        } catch (err) {
            console.error('Failed to copy:', err);
            if (window.messageNotification?.error) {
                window.messageNotification.error('复制失败');
            }
        }
    }, [children]);

    // 使用 useEffect 监听 children 变化
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            renderMermaid();
        }, 100); // 添加短暂延迟，避免频繁重渲染

        return () => clearTimeout(timeoutId);
    }, [renderMermaid]);

    // 组件卸载时清理
    useEffect(() => {
        return () => {
            clearMermaidCache();
        };
    }, [clearMermaidCache]);

    return (
        <div className="mermaid-view">
            <div className="mermaid-header">
                <span className="mermaid-label">📊 Mermaid Diagram</span>
                <div className="mermaid-actions">
                    <button className="mermaid-button" onClick={copyToClipboard} title="复制代码">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path
                                fill="currentColor"
                                d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"
                            />
                        </svg>
                        复制
                    </button>
                </div>
            </div>
            <div className="mermaid-container">
                {isLoading && (
                    <div className="mermaid-loading">
                        <div className="loading-spinner"></div>
                        <span>渲染图表中...</span>
                    </div>
                )}
                <div
                    ref={containerRef}
                    className={`mermaid-content ${isLoading ? 'loading' : ''} ${
                        error ? 'error' : ''
                    }`}
                />
            </div>
        </div>
    );
};

export default MermaidView;
