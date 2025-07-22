import React from 'react';
import { Button, Dropdown, Space, Tag, Tooltip } from 'antd';
import { SearchOutlined, DownOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { observer } from 'mobx-react-lite';

import { SEARCH_ENGINE_NAMES } from '@/utils/constant';
import rootStore from '@/store';

import './index.scss';

interface SearchEngineSelectorProps {
    selectedEngine: string;
    onEngineSelect: (engine: string) => void;
    onToggleSearch: () => void;
    disabled?: boolean;
}

const SearchEngineSelector: React.FC<SearchEngineSelectorProps> = observer(
    ({ selectedEngine, onEngineSelect, onToggleSearch, disabled = false }) => {
        const { settingStore } = rootStore;
        const enabledEngines = settingStore.enabledSearchEngines;
        const isSearchEnabled = settingStore.webSearchEnabled;

        // Create menu items for enabled search engines
        const menuItems: MenuProps['items'] = enabledEngines.map((engine) => ({
            key: engine,
            label: (
                <div className="search-engine-item">
                    <span>{SEARCH_ENGINE_NAMES[engine]?.split('(')[0].trim() || engine}</span>
                    {selectedEngine === engine && <Tag color="blue">当前</Tag>}
                </div>
            ),
            onClick: () => onEngineSelect(engine),
        }));

        if (!isSearchEnabled || enabledEngines.length === 0) {
            return (
                <Tooltip title="开启网页搜索">
                    <Button
                        type="text"
                        size="small"
                        icon={<SearchOutlined />}
                        onClick={onToggleSearch}
                        disabled={disabled}
                        className="search-toggle-button"
                    />
                </Tooltip>
            );
        }

        if (enabledEngines.length === 1) {
            return (
                <Tooltip
                    title={`关闭网页搜索 (${
                        SEARCH_ENGINE_NAMES[enabledEngines[0]]?.split('(')[0].trim() ||
                        enabledEngines[0]
                    })`}
                >
                    <Button
                        type="primary"
                        size="small"
                        icon={<SearchOutlined />}
                        onClick={onToggleSearch}
                        disabled={disabled}
                        className="search-toggle-button"
                    />
                </Tooltip>
            );
        }

        return (
            <Dropdown
                menu={{ items: menuItems }}
                trigger={['click']}
                disabled={disabled || !isSearchEnabled}
                placement="topRight"
            >
                <Button
                    type={isSearchEnabled ? 'primary' : 'text'}
                    size="small"
                    className="search-engine-selector"
                    disabled={disabled}
                >
                    <Space size="small">
                        <SearchOutlined />
                        <span className="selected-engine-name">
                            {SEARCH_ENGINE_NAMES[selectedEngine]?.split('(')[0].trim() ||
                                selectedEngine}
                        </span>
                        <DownOutlined />
                    </Space>
                </Button>
            </Dropdown>
        );
    },
);

export default SearchEngineSelector;
