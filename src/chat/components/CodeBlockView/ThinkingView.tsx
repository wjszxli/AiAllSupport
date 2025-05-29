import React, { memo, useState, useEffect } from 'react';
import { EyeOutlined, EyeInvisibleOutlined, LoadingOutlined } from '@ant-design/icons';
import { t } from '@/locales/i18n';
import './ThinkingView.scss';

interface Props {
    children: string;
    thinking_millsec?: number;
    isStreaming?: boolean;
}

/**
 * 思考内容视图组件
 * 显示AI的思考过程，可折叠展开
 */
const ThinkingView: React.FC<Props> = ({ children, thinking_millsec, isStreaming = false }) => {
    // 流式思考内容默认展开，让用户能立即看到思考过程
    const [isExpanded, setIsExpanded] = useState(isStreaming);

    // 当开始流式处理时，自动展开思考内容
    useEffect(() => {
        if (isStreaming) {
            setIsExpanded(true);
        }
    }, [isStreaming]);

    // 格式化思考时间
    const formatThinkingTime = (millsec?: number): string => {
        if (!millsec) return '';
        if (millsec < 1000) {
            return `${millsec}ms`;
        }
        return `${(millsec / 1000).toFixed(1)}s`;
    };

    // 确定显示状态
    const isCompleted = !isStreaming && thinking_millsec !== undefined;
    const displayTitle = isStreaming ? t('thinking') || 'AI 正在思考...' : t('think') || '思考过程';

    return (
        <div className={`thinking-view ${isStreaming ? 'streaming' : 'completed'}`}>
            <div className="thinking-header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="thinking-title">
                    <span className="thinking-icon">
                        {isStreaming ? <LoadingOutlined spin /> : '🧠'}
                    </span>
                    <span className="thinking-label">{displayTitle}</span>
                    {isCompleted && thinking_millsec && (
                        <span className="thinking-time">
                            ({formatThinkingTime(thinking_millsec)})
                        </span>
                    )}
                    {isStreaming && (
                        <span className="thinking-status">{t('processing') || '思考中...'}</span>
                    )}
                </div>
                <button className="thinking-toggle" title={isExpanded ? '收起' : '展开'}>
                    {isExpanded ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </button>
            </div>
            {isExpanded && (
                <div className="thinking-content">
                    <div className="thinking-text">
                        {children}
                        {isStreaming && <span className="thinking-cursor">▋</span>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(ThinkingView);
