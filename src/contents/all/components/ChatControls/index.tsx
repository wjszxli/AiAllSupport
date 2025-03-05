import React, { useCallback, useEffect, useState } from 'react';
import { Switch, Tooltip } from 'antd';
import { GlobalOutlined, LinkOutlined } from '@ant-design/icons';
import storage from '@/utils/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { featureSettings } from '@/utils/featureSettings';

import './index.scss';

const ChatControls: React.FC = () => {
    const [webSearchEnabled, setWebSearchEnabled] = useState(false);
    const [useWebpageContext, setUseWebpageContext] = useState(true);
    const { t } = useLanguage();

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const [webSearch, webpageContext] = await Promise.all([
                    storage.getWebSearchEnabled(),
                    storage.getUseWebpageContext()
                ]);
                
                setWebSearchEnabled(webSearch ?? false);
                setUseWebpageContext(webpageContext ?? true);
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        };

        loadSettings();
    }, []);

    const handleWebSearchToggle = useCallback(async (checked: boolean) => {
        try {
            const newState = await featureSettings.toggleWebSearch(checked, t);
            setWebSearchEnabled(newState);
        } catch (error) {
            console.error('Failed to toggle web search:', error);
        }
    }, [t]);

    const handleWebpageContextToggle = useCallback(async (checked: boolean) => {
        try {
            const newState = await featureSettings.toggleWebpageContext(checked, t);
            setUseWebpageContext(newState);
        } catch (error) {
            console.error('Failed to toggle webpage context:', error);
        }
    }, [t]);

    return (
        <div className="chat-controls">
            <Tooltip title={t('includeWebpageTooltip' as any)}>
                <div className="control-item">
                    <LinkOutlined
                        className={useWebpageContext ? 'icon-enabled' : 'icon-disabled'}
                    />
                    <span className="control-label">{t('includeWebpage' as any)}</span>
                    <Switch
                        size="small"
                        checked={useWebpageContext}
                        onChange={handleWebpageContextToggle}
                        checkedChildren={t('on' as any)}
                        unCheckedChildren={t('off' as any)}
                    />
                </div>
            </Tooltip>
            <Tooltip title={t('webSearchTooltip' as any)}>
                <div className="control-item">
                    <GlobalOutlined
                        className={webSearchEnabled ? 'icon-enabled' : 'icon-disabled'}
                    />
                    <span className="control-label">{t('webSearch' as any)}</span>
                    <Switch
                        size="small"
                        checked={webSearchEnabled}
                        onChange={handleWebSearchToggle}
                        checkedChildren={t('on' as any)}
                        unCheckedChildren={t('off' as any)}
                    />
                </div>
            </Tooltip>
        </div>
    );
};

export default ChatControls;
