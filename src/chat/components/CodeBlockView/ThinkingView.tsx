import React, { useState, useEffect } from 'react';
import { EyeOutlined, EyeInvisibleOutlined, LoadingOutlined } from '@ant-design/icons';
import { t } from '@/locales/i18n';
import { MessageBlockStatus, type ThinkingMessageBlock } from '@/types/messageBlock';
import './ThinkingView.scss';

interface Props {
    thinkingBlock: ThinkingMessageBlock;
    forceCollapsed?: boolean;
}

/**
 * 思考内容视图组件
 * 显示AI的思考过程，可折叠展开
 * 内部自主判断思考状态，减少外部耦合
 */
const ThinkingView: React.FC<Props> = ({ thinkingBlock, forceCollapsed }) => {
    // 内部判断思考状态
    const isStreaming = thinkingBlock.status === MessageBlockStatus.STREAMING;
    const isCompleted = thinkingBlock.status === MessageBlockStatus.SUCCESS;
    const hasContent = Boolean(thinkingBlock.content && thinkingBlock.content.trim());

    // 流式思考内容默认展开，让用户能立即看到思考过程
    // 如果有内容或正在流式处理，默认展开
    // 但如果强制折叠，则初始状态为折叠
    const [isExpanded, setIsExpanded] = useState(() => {
        if (forceCollapsed) {
            return false;
        }
        const initialExpanded = isStreaming || hasContent;
        return initialExpanded;
    });

    // 处理展开/折叠切换
    const handleToggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    // 当开始流式处理时，自动展开思考内容（除非强制折叠）
    useEffect(() => {
        if (isStreaming && !forceCollapsed) {
            setIsExpanded(true);
        }
    }, [isStreaming, forceCollapsed]);

    // 当思考完成时，自动折叠思考内容
    useEffect(() => {
        if (isCompleted && !isStreaming) {
            setIsExpanded(false);
        }
    }, [isCompleted, isStreaming, thinkingBlock.id]);

    // 简化内容变化监听逻辑，避免过度干预用户的折叠/展开选择
    // 只在思考刚开始且有内容时自动展开一次（除非强制折叠）
    useEffect(() => {
        if (isStreaming && hasContent && !isExpanded && !forceCollapsed) {
            setIsExpanded(true);
        }
    }, [isStreaming, hasContent, forceCollapsed]); // 移除 isExpanded 依赖，避免无限循环

    // 格式化思考时间
    const formatThinkingTime = (millsec?: number): string => {
        if (!millsec) return '';
        if (millsec < 1000) {
            return `${millsec}ms`;
        }
        return `${(millsec / 1000).toFixed(1)}s`;
    };

    // 确定显示状态和标题
    const getDisplayInfo = () => {
        if (isStreaming) {
            return {
                title: t('thinking') || 'AI 正在思考...',
                icon: <LoadingOutlined spin />,
                showStatus: true,
                statusText: t('processing') || '思考中...',
                showTime: Boolean(thinkingBlock.thinking_millsec), // 流式时如果有时间也显示
            };
        }

        if (isCompleted) {
            return {
                title: t('think') || '思考过程',
                icon: '🧠',
                showStatus: true,
                statusText: '',
                showTime: Boolean(thinkingBlock.thinking_millsec),
            };
        }

        // 其他状态（如初始化、错误等）
        return {
            title: t('think') || '思考过程',
            icon: '🧠',
            showStatus: true,
            statusText: '',
            showTime: Boolean(thinkingBlock.thinking_millsec),
        };
    };

    const displayInfo = getDisplayInfo();

    // 如果没有内容且不在流式处理中，不显示组件
    if (!hasContent && !isStreaming) {
        return null;
    }

    return (
        <div className={`thinking-view ${isStreaming ? 'streaming' : 'completed'}`}>
            <div className="thinking-header" onClick={handleToggleExpanded}>
                <div className="thinking-title">
                    <span className="thinking-icon">{displayInfo.icon}</span>
                    <span className="thinking-label">{displayInfo.title}</span>
                    {displayInfo.showTime && thinkingBlock.thinking_millsec && (
                        <span className="thinking-time">
                            ({formatThinkingTime(thinkingBlock.thinking_millsec)})
                        </span>
                    )}
                    {displayInfo.showStatus && (
                        <span className="thinking-status">{displayInfo.statusText}</span>
                    )}
                </div>
                <button className="thinking-toggle" title={isExpanded ? '收起' : '展开'}>
                    {isExpanded ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </button>
            </div>
            {isExpanded && (
                <div className="thinking-content">
                    <div className="thinking-text">
                        {thinkingBlock.content || ''}
                        {isStreaming && <span className="thinking-cursor">▋</span>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThinkingView;
