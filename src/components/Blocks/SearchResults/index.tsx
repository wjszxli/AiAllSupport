import React, { useState } from 'react';
import { EyeOutlined, EyeInvisibleOutlined, SearchOutlined, LinkOutlined } from '@ant-design/icons';
import { t } from '@/locales/i18n';
import { type SearchResultsMessageBlock } from '@/types/messageBlock';
import { SEARCH_ENGINE_NAMES } from '@/utils/constant';
import './index.scss';

interface Props {
    searchBlock: SearchResultsMessageBlock;
    forceExpanded?: boolean;
}

/**
 * 搜索结果视图组件
 * 显示搜索结果列表，默认折叠，可展开
 */
const SearchResultsView: React.FC<Props> = ({ searchBlock, forceExpanded = false }) => {
    const [isExpanded, setIsExpanded] = useState(forceExpanded);

    const { results, engine, contentFetched } = searchBlock;
    const resultsCount = results?.length || 0;

    // 获取引擎显示名称
    const getEngineDisplayName = (engineStr: string) => {
        // 如果是多个引擎，用逗号分隔
        const engines = engineStr.split(', ');
        return engines.map((eng) => SEARCH_ENGINE_NAMES[eng.trim()] || eng.trim()).join(', ');
    };

    // 处理展开/折叠切换
    const handleToggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    // 处理点击搜索结果项 - 打开所有链接
    const handleResultClick = (e: React.MouseEvent) => {
        e.stopPropagation();

        // 打开所有搜索结果的链接
        results.forEach((result) => {
            if (result.url) {
                window.open(result.url, '_blank', 'noopener,noreferrer');
                return;
            }
        });
    };

    if (!results || results.length === 0) {
        return null;
    }

    return (
        <div className="search-results-view">
            <div className="search-results-header" onClick={handleToggleExpanded}>
                <div className="search-results-title">
                    <span className="search-results-icon">
                        <SearchOutlined />
                    </span>
                    <span className="search-results-label">{t('searchResults') || '搜索结果'}</span>
                    <span className="search-results-info">
                        ({resultsCount} {t('results') || '条结果'} · {getEngineDisplayName(engine)})
                    </span>
                    {contentFetched && (
                        <span className="search-results-enhanced">
                            · {t('contentFetched') || '已获取内容'}
                        </span>
                    )}
                </div>
                <button className="search-results-toggle" title={isExpanded ? '收起' : '展开'}>
                    {isExpanded ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </button>
            </div>

            {isExpanded && (
                <div className="search-results-content">
                    <div className="search-results-list">
                        {results.map((result, index) => (
                            <div
                                key={index}
                                className="search-result-item"
                                onClick={handleResultClick}
                            >
                                <div className="search-result-title">
                                    <LinkOutlined className="search-result-link-icon" />
                                    <span className="search-result-title-text">{result.title}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchResultsView;
