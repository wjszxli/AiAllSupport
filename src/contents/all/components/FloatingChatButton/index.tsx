import React, { useState, useMemo } from 'react';
import './index.scss';

interface FloatingChatButtonProps {
    onClick: () => void;
}

const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({ onClick }) => {
    const [isHovered, setIsHovered] = useState(false);

    // 检测平台并返回对应的快捷键
    const shortcutKey = useMemo(() => {
        const userAgent = navigator.userAgent.toLowerCase();
        const platform = navigator.platform.toLowerCase();

        // 检测 Mac 平台
        if (platform.includes('mac') || userAgent.includes('mac')) {
            return '⌘ + ⇧ + Y';
        }
        // 检测 Windows 平台
        else if (platform.includes('win') || userAgent.includes('windows')) {
            return 'Ctrl + Shift + Y';
        }
        // 其他平台（Linux等）
        else {
            return 'Ctrl + Shift + Y';
        }
    }, []);

    return (
        <>
            {/* 悬停时显示的横向卡片 */}
            {isHovered && (
                <div className="floating-shortcut-card">
                    <button
                        className="shortcut-close-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsHovered(false);
                        }}
                    >
                        ×
                    </button>
                    <div className="shortcut-content">
                        <div className="shortcut-icon">
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z"
                                    fill="currentColor"
                                />
                                <circle cx="8" cy="10" r="1.5" fill="currentColor" />
                                <circle cx="12" cy="10" r="1.5" fill="currentColor" />
                                <circle cx="16" cy="10" r="1.5" fill="currentColor" />
                            </svg>
                        </div>
                        <span className="shortcut-text">{shortcutKey}</span>
                    </div>
                </div>
            )}

            {/* 浮动聊天按钮 */}
            <div
                className={`floating-chat-button ${isHovered ? 'hovered' : ''}`}
                onClick={onClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                role="button"
                tabIndex={0}
                aria-label="Open chat"
            >
                <div className="chat-icon">
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z"
                            fill="currentColor"
                        />
                        <circle cx="8" cy="10" r="1.5" fill="currentColor" />
                        <circle cx="12" cy="10" r="1.5" fill="currentColor" />
                        <circle cx="16" cy="10" r="1.5" fill="currentColor" />
                    </svg>
                </div>
            </div>
        </>
    );
};

export default FloatingChatButton;
