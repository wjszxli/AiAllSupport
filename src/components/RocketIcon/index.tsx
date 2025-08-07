import React from 'react';
import './index.scss';

interface RocketIconProps {
    size?: number | string;
    className?: string;
    style?: React.CSSProperties;
}

const RocketIcon: React.FC<RocketIconProps> = ({ size = 16, className = '', style = {} }) => {
    // 根据尺寸选择合适的图标
    const getIconPath = (size: number | string) => {
        const numSize = typeof size === 'string' ? parseInt(size) : size;

        if (numSize <= 16) {
            return '/icons/icon16.png';
        } else if (numSize <= 24) {
            return '/icons/icon24.png';
        } else if (numSize <= 32) {
            return '/icons/icon32.png';
        } else if (numSize <= 48) {
            return '/icons/icon48.png';
        } else {
            return '/icons/icon128.png';
        }
    };

    const iconPath = getIconPath(size);
    const iconSize = typeof size === 'string' ? size : `${size}px`;

    return (
        <img
            src={iconPath}
            alt="Rocket Icon"
            className={`rocket-icon ${className}`}
            style={{
                width: iconSize,
                height: iconSize,
                display: 'inline-block',
                verticalAlign: 'middle',
                ...style,
            }}
        />
    );
};

export default RocketIcon;
