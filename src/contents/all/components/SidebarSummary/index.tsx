import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Spin, Tooltip, message } from 'antd';
import {
    CloseOutlined,
    ReloadOutlined,
    FileTextOutlined,
    ExclamationCircleOutlined,
    FileSearchOutlined,
} from '@ant-design/icons';
import { t } from '@/locales/i18n';
import { useThrottledCallback } from '@/utils/reactOptimizations';
import rootStore from '@/store';
import { ConfigModelType } from '@/types';
import { pageSummaryService, PageContent } from '@/services/PageSummaryService';
import { md } from '@/utils/markdownRenderer';
import DOMPurify from 'dompurify';

import './index.scss';

interface SidebarSummaryProps {
    isVisible: boolean;
    onClose: () => void;
}

// 使用服务中定义的类型
type PageInfo = PageContent;

const SidebarSummary: React.FC<SidebarSummaryProps> = ({ isVisible, onClose }) => {
    const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
    const [summary, setSummary] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [position, setPosition] = useState({ x: window.innerWidth - 400, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    const sidebarRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef({ x: 0, y: 0 });

    // 获取页面内容
    const getPageContent = useCallback(async (): Promise<PageInfo | null> => {
        try {
            return await pageSummaryService.extractPageContent();
        } catch (error) {
            console.error('Failed to get page content:', error);
            return null;
        }
    }, []);

    // 生成页面总结
    const generateSummary = useCallback(async (pageContent: PageInfo) => {
        setIsLoading(true);
        setError(null);
        setSummary('');

        try {
            // 启动流式内容监听
            const robot = rootStore.llmStore.getRobotForType(ConfigModelType.SIDEBAR);
            let streamingInterval: NodeJS.Timeout | null = null;

            if (robot?.selectedTopicId) {
                // 监听流式更新
                streamingInterval = setInterval(() => {
                    try {
                        const messages = rootStore.messageStore.getMessagesForTopic(
                            robot.selectedTopicId!,
                        );
                        const latestMessage = messages[messages.length - 1];

                        if (latestMessage && latestMessage.role === 'assistant') {
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

                                if (content) {
                                    const formattedContent =
                                        pageSummaryService.formatSummary(content);
                                    setSummary(formattedContent);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error updating streaming content:', error);
                    }
                }, 1000); // 每秒更新一次
            }

            // 调用生成总结服务
            const result = await pageSummaryService.generateSummary(pageContent, {
                language: '中文',
                maxLength: 800,
                includeKeyPoints: true,
                includeStructure: true,
            });

            // 清理流式监听
            if (streamingInterval) {
                clearInterval(streamingInterval);
            }

            const formattedSummary = pageSummaryService.formatSummary(result);
            setSummary(formattedSummary);
        } catch (error) {
            console.error('Failed to generate summary:', error);
            const errorMessage = error instanceof Error ? error.message : '生成总结失败';
            setError(errorMessage);
            message.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 刷新总结
    const handleRefresh = useCallback(async () => {
        const content = await getPageContent();
        if (content) {
            setPageInfo(content);
            await generateSummary(content);
        } else {
            setError('无法获取页面内容');
        }
    }, [getPageContent, generateSummary]);

    // 初始化时获取页面内容
    useEffect(() => {
        if (isVisible && !pageInfo) {
            handleRefresh();
        }
    }, [isVisible, pageInfo, handleRefresh]);

    // 拖拽处理
    const handleMouseMove = useThrottledCallback(
        (moveEvent: MouseEvent) => {
            if (!isDragging) return;

            moveEvent.preventDefault();

            const sidebarWidth = sidebarRef.current?.offsetWidth || 400;
            const sidebarHeight = sidebarRef.current?.offsetHeight || 0;

            const newX = Math.max(
                0,
                Math.min(
                    moveEvent.clientX - dragStartRef.current.x,
                    window.innerWidth - sidebarWidth,
                ),
            );

            const newY = Math.max(
                0,
                Math.min(
                    moveEvent.clientY - dragStartRef.current.y,
                    window.innerHeight - sidebarHeight,
                ),
            );

            setPosition({ x: newX, y: newY });
        },
        16,
        [isDragging],
    );

    const handleMouseUp = useCallback(() => {
        if (sidebarRef.current) {
            sidebarRef.current.classList.remove('dragging');
        }
        setIsDragging(false);

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();

            if (sidebarRef.current) {
                sidebarRef.current.classList.add('dragging');
            }
            setIsDragging(true);

            dragStartRef.current = {
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        },
        [position, handleMouseMove, handleMouseUp],
    );

    // 复制总结内容
    const handleCopySummary = useCallback(() => {
        if (summary) {
            navigator.clipboard
                .writeText(summary)
                .then(() => {
                    message.success('总结内容已复制到剪贴板');
                })
                .catch(() => {
                    message.error('复制失败');
                });
        }
    }, [summary]);

    // 渲染总结内容
    const renderSummaryContent = () => {
        if (isLoading) {
            return (
                <div className="loading-state">
                    <Spin size="large" />
                    <div className="loading-text">正在生成页面总结...</div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="error-state">
                    <ExclamationCircleOutlined className="error-icon" />
                    <div className="error-title">生成失败</div>
                    <div className="error-message">{error}</div>
                    <Button type="primary" onClick={handleRefresh}>
                        重试
                    </Button>
                </div>
            );
        }

        if (!summary) {
            return (
                <div className="empty-state">
                    <FileSearchOutlined className="empty-icon" />
                    <div className="empty-title">暂无总结</div>
                    <div className="empty-description">点击刷新按钮生成页面总结</div>
                    <Button type="primary" onClick={handleRefresh}>
                        生成总结
                    </Button>
                </div>
            );
        }

        // 渲染markdown内容
        const renderedContent = md.render(summary);
        const sanitizedContent = DOMPurify.sanitize(renderedContent);

        return (
            <div className="summary-text" dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
        );
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div
            ref={sidebarRef}
            className={`sidebar-summary-container ${isVisible ? 'visible' : ''} ${
                isDragging ? 'dragging' : ''
            }`}
            style={{
                right: isVisible ? 0 : -400,
                top: position.y,
            }}
        >
            <div className="sidebar-header" onMouseDown={handleMouseDown}>
                <div className="sidebar-title">
                    <FileTextOutlined />
                    {t('pageSummary') || '页面总结'}
                </div>
                <div className="sidebar-actions">
                    <Tooltip title="刷新总结" styles={{ root: { zIndex: 10001 } }}>
                        <div
                            className="action-button refresh-button"
                            onClick={handleRefresh}
                            role="button"
                            tabIndex={0}
                        >
                            <ReloadOutlined style={{ fontSize: 14 }} />
                        </div>
                    </Tooltip>
                    <div
                        className="action-button close-button"
                        onClick={onClose}
                        role="button"
                        tabIndex={0}
                    >
                        <CloseOutlined style={{ fontSize: 14 }} />
                    </div>
                </div>
            </div>

            <div className="sidebar-content">
                {pageInfo && (
                    <div className="page-info">
                        <div className="page-title">{pageInfo.title}</div>
                        <div className="page-url">{pageInfo.url}</div>
                    </div>
                )}

                <div className="summary-section">
                    <div className="summary-header">
                        <div className="summary-title">
                            <FileTextOutlined />
                            内容总结
                        </div>
                        {summary && (
                            <div className="summary-actions">
                                <Button size="small" onClick={handleCopySummary}>
                                    复制
                                </Button>
                                <Button size="small" onClick={handleRefresh}>
                                    重新生成
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="summary-content">{renderSummaryContent()}</div>
                </div>
            </div>
        </div>
    );
};

export default SidebarSummary;
