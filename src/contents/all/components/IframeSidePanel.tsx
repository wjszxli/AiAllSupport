import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './IframeSidePanel.scss';

interface IframeSidePanelProps {
    onClose: () => void;
}

// 检测是否为 Arc 浏览器
const isArcBrowser = navigator.userAgent.includes('Arc/') || navigator.userAgent.includes('Arc ');

const IframeSidePanel: React.FC<IframeSidePanelProps> = ({ onClose }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const sidePanelUrl = chrome.runtime.getURL('sidepanel.html');

    useEffect(() => {
        // 添加键盘事件监听
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // 处理 iframe 加载完成事件
        const handleIframeLoad = () => {
            setIsLoading(false);
        };

        const iframe = iframeRef.current;
        if (iframe) {
            iframe.addEventListener('load', handleIframeLoad);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (iframe) {
                iframe.removeEventListener('load', handleIframeLoad);
            }
        };
    }, [onClose]);

    // 防止冒泡事件到父元素
    const handleContainerClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <div className="iframe-sidepanel-overlay" onClick={onClose}>
            <div
                className={`iframe-sidepanel-container ${isArcBrowser ? 'arc-browser' : ''}`}
                onClick={handleContainerClick}
            >
                <div className="iframe-sidepanel-header">
                    <div className="iframe-sidepanel-title">AI 聊天助手</div>
                    <button className="iframe-sidepanel-close" onClick={onClose}>
                        ×
                    </button>
                </div>
                <div className="iframe-sidepanel-content">
                    {isLoading && (
                        <div className="iframe-sidepanel-loading">
                            <div className="loading-spinner"></div>
                            <div>加载中...</div>
                        </div>
                    )}
                    <iframe
                        ref={iframeRef}
                        src={sidePanelUrl}
                        title="Side Panel"
                        className="iframe-sidepanel-iframe"
                    ></iframe>
                </div>
            </div>
        </div>
    );
};

// 创建并管理 IframeSidePanel 实例
export class IframeSidePanelManager {
    private static container: HTMLDivElement | null = null;
    private static isVisible = false;
    private static root: any = null;

    // 显示侧边栏
    public static show(): void {
        if (this.isVisible) return;

        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'iframe-sidepanel-root';
            document.body.appendChild(this.container);
            this.root = createRoot(this.container);
        }

        this.isVisible = true;

        this.root.render(<IframeSidePanel onClose={this.hide.bind(this)} />);

        // 禁用页面滚动
        document.body.style.overflow = 'hidden';
    }

    // 隐藏侧边栏
    public static hide(): void {
        if (!this.isVisible || !this.container) return;

        this.isVisible = false;
        this.root.render(null);

        // 恢复页面滚动
        document.body.style.overflow = '';
    }

    // 切换侧边栏显示状态
    public static toggle(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
}

export default IframeSidePanel;
