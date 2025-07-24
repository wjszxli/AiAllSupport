import { Avatar, Button, List, Input, Select, Tag, Tooltip } from 'antd';
import React, { useState, forwardRef, useImperativeHandle } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { observer } from 'mobx-react';
import { useStore } from '@/store';
import { ConfigModelType, Provider } from '@/types';
import { getProviderLogo, PROVIDER_CONFIG } from '@/config/providers';
import { getProviderName } from '@/utils/i18n';
import { SYSTEM_MODELS } from '@/config/models';
import ConfigModal from './components/ConfigModal';

interface SortableItemProps {
    provider: Provider;
    llmStore: any;
    openModal: (provider: Provider) => Promise<void>;
}

// 创建可排序的列表项组件
const SortableItem: React.FC<SortableItemProps> = ({ provider, llmStore, openModal }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: provider.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    // 检查该提供商是否被选为聊天、弹窗或侧边栏模型
    const chatModel = llmStore.getModelForType(ConfigModelType.CHAT);
    const popupModel = llmStore.getModelForType(ConfigModelType.POPUP);
    const sidebarModel = llmStore.getModelForType(ConfigModelType.SIDEBAR);

    // 检查该提供商的模型是否被选中
    const isChatProvider = chatModel && chatModel.provider === provider.id;
    const isPopupProvider = popupModel && popupModel.provider === provider.id;
    const isSidebarProvider = sidebarModel && sidebarModel.provider === provider.id;

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <List.Item
                key={provider.id}
                style={{
                    cursor: 'move',
                    padding: '12px 16px',
                    borderBottom: '1px solid #f0f0f0',
                }}
            >
                <List.Item.Meta
                    avatar={<Avatar src={getProviderLogo(provider.id)} />}
                    title={
                        <a
                            href={
                                // @ts-ignore
                                PROVIDER_CONFIG[provider.id]?.websites?.official
                            }
                        >
                            {getProviderName(provider)}
                        </a>
                    }
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isChatProvider && (
                        <Tooltip title={`聊天界面使用模型: ${chatModel.name}`}>
                            <Tag color="blue">聊天</Tag>
                        </Tooltip>
                    )}
                    {isPopupProvider && (
                        <Tooltip title={`弹窗界面使用模型: ${popupModel.name}`}>
                            <Tag color="green">弹窗</Tag>
                        </Tooltip>
                    )}
                    {isSidebarProvider && (
                        <Tooltip title={`侧边栏使用模型: ${sidebarModel.name}`}>
                            <Tag color="purple">侧边栏</Tag>
                        </Tooltip>
                    )}
                    <Button
                        color="cyan"
                        variant="solid"
                        onClick={(e) => {
                            // 阻止点击按钮时触发拖拽
                            e.stopPropagation();
                            openModal(provider);
                        }}
                    >
                        设置
                    </Button>
                </div>
            </List.Item>
        </div>
    );
};

// 添加接口定义
export interface ApiSettingsRef {
    openModal: (provider: Provider) => Promise<void>;
    openFirstProviderModal: () => Promise<void>;
    handleCancel: () => void;
}

// @ts-ignore
const ApiSettings = forwardRef<ApiSettingsRef, {}>((props, ref) => {
    const { llmStore } = useStore();

    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [providerSearch, setProviderSearch] = useState<string>('');
    const [providers, setProviders] = useState<Provider[]>(llmStore.providers);
    const [selectProviderId, setSelectProviderId] = useState<string>('');

    // 设置拖拽传感器
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 需要移动8px才激活拖拽，防止误触
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const allGroups = React.useMemo(() => {
        const groupSet = new Set<string>();
        Object.values(SYSTEM_MODELS).forEach((models) => {
            models.forEach((model) => {
                if (model.group) groupSet.add(model.group);
            });
        });
        const groups = Array.from(groupSet);
        return groups.sort((a, b) => {
            const aFree = a.includes('免费');
            const bFree = b.includes('免费');
            if (aFree && !bFree) return -1;
            if (!aFree && bFree) return 1;
            return a.localeCompare(b);
        });
    }, []);

    const filteredProviders = React.useMemo(() => {
        let result = providers;
        if (selectedGroups.length > 0) {
            result = result.filter((provider) =>
                provider.models.some((model) => selectedGroups.includes(model.group)),
            );
        }
        if (providerSearch.trim()) {
            const searchLower = providerSearch.trim().toLowerCase();
            result = result.filter((provider) =>
                getProviderName(provider).toLowerCase().includes(searchLower),
            );
        }
        return result;
    }, [providers, selectedGroups, providerSearch]);

    const openModal = async (provider: Provider) => {
        setSelectProviderId(provider.id);
        setIsModalOpen(true);
    };

    // 打开第一个提供商的配置弹窗（用于引导）
    const openFirstProviderModal = async () => {
        const firstProvider = providers.find((p) => !p.isSystem) || providers[0];
        if (firstProvider) {
            await openModal(firstProvider);
        }
    };

    useImperativeHandle(ref, () => ({
        openModal,
        openFirstProviderModal,
        handleCancel,
    }));

    const handleOk = async () => {
        setIsModalOpen(false);
    };

    const handleCancel = () => {
        setIsModalOpen(false);
    };

    // 处理拖拽结束事件
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setProviders((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                // 更新本地状态
                const newProviders = arrayMove(items, oldIndex, newIndex);

                // 同步到 llmStore
                llmStore.providers = newProviders;

                return newProviders;
            });
        }
    };

    return (
        <>
            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
                <Input
                    placeholder="搜索供应商"
                    value={providerSearch}
                    onChange={(e) => setProviderSearch(e.target.value)}
                    style={{ width: 200 }}
                    allowClear
                />
                <Select
                    mode="multiple"
                    allowClear
                    placeholder="按模型分组筛选"
                    value={selectedGroups}
                    onChange={setSelectedGroups}
                    style={{ minWidth: 220, flex: 1 }}
                    options={allGroups.map((group) => ({ label: group, value: group }))}
                    maxTagCount={2}
                />
            </div>

            <div
                style={{
                    maxHeight: '60vh',
                    overflow: 'auto',
                    border: '1px solid #f0f0f0',
                    borderRadius: '4px',
                    padding: '0 4px',
                }}
            >
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={filteredProviders.map((item) => item.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <List
                            itemLayout="horizontal"
                            dataSource={filteredProviders}
                            renderItem={(item) => (
                                <SortableItem
                                    key={item.id}
                                    provider={item}
                                    llmStore={llmStore}
                                    openModal={openModal}
                                />
                            )}
                        />
                    </SortableContext>
                </DndContext>
            </div>

            <ConfigModal
                isModalOpen={isModalOpen}
                onCancel={handleCancel}
                onOk={handleOk}
                selectProviderId={selectProviderId}
            />
        </>
    );
});

export default observer(ApiSettings);
