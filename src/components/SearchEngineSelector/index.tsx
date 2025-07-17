import React from 'react';
import { Button, Dropdown, Space, Tag } from 'antd';
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

        // If no engines are enabled, show a disabled state
        if (!isSearchEnabled || enabledEngines.length === 0) {
            return (
                <Button
                    type="text"
                    size="small"
                    icon={<SearchOutlined />}
                    onClick={onToggleSearch}
                    disabled={disabled}
                    className="search-toggle-button"
                />
            );
        }

        // If only one engine is enabled, show a simple toggle button
        if (enabledEngines.length === 1) {
            return (
                <Button
                    type={isSearchEnabled ? 'primary' : 'text'}
                    size="small"
                    icon={<SearchOutlined />}
                    onClick={onToggleSearch}
                    disabled={disabled}
                    className="search-toggle-button"
                    title={
                        isSearchEnabled
                            ? `关闭网页搜索 (${
                                  SEARCH_ENGINE_NAMES[enabledEngines[0]]?.split('(')[0].trim() ||
                                  enabledEngines[0]
                              })`
                            : '开启网页搜索'
                    }
                />
            );
        }

        // Multiple engines enabled - show dropdown selector
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
