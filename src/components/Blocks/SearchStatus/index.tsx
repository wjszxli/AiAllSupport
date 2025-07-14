import React from 'react';
import { SearchOutlined, LoadingOutlined } from '@ant-design/icons';
import { t } from '@/locales/i18n';
import { SEARCH_ENGINE_NAMES } from '@/utils/constant';
import './index.scss';

interface Props {
    query: string;
    engine?: string;
}

/**
 * 搜索状态视图组件
 * 显示搜索进度状态
 */
const SearchStatusView: React.FC<Props> = ({ query, engine }) => {
    // 获取引擎显示名称
    const getEngineDisplayName = (engineKey?: string) => {
        if (!engineKey) return '';
        return SEARCH_ENGINE_NAMES[engineKey] || engineKey;
    };

    return (
        <div className="search-status-view">
            <div className="search-status-content">
                <div className="search-status-icon">
                    <LoadingOutlined spin />
                </div>
                <div className="search-status-text">
                    <span className="search-status-title">
                        <SearchOutlined />
                        {t('searching') || '正在搜索'} "{query}"
                    </span>
                    {engine && (
                        <span className="search-status-engine">
                            {t('using') || '使用'} {getEngineDisplayName(engine)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchStatusView;
