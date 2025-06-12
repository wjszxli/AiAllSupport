import React from 'react';
import { StopOutlined } from '@ant-design/icons';
import { t } from '@/locales/i18n';
import './index.scss';

interface Props {
    content?: string;
}

const InterruptedView: React.FC<Props> = ({ content }) => {
    return (
        <div className="interrupted-view">
            <div className="interrupted-header">
                <div className="interrupted-title">
                    <div className="interrupted-icon">
                        <StopOutlined />
                    </div>
                    <span className="interrupted-label">{t('interrupted') || '已中断'}</span>
                </div>
            </div>
            {content && content.trim() && (
                <div className="interrupted-content">
                    <div className="interrupted-text">{content}</div>
                </div>
            )}
        </div>
    );
};

export default InterruptedView;
