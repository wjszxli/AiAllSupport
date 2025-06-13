import React from 'react';
import { StopOutlined } from '@ant-design/icons';
import { t } from '@/locales/i18n';
import './index.scss';

const InterruptedView: React.FC = () => {
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
        </div>
    );
};

export default InterruptedView;
