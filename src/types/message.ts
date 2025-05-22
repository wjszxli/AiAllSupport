import { Metrics, Usage, Model, AssistantMessageStatus, UserMessageStatus } from '.';

import { MessageBlock } from './messageBlock';

export type Message = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    assistantId: string;
    topicId: string;
    createdAt: string;
    updatedAt?: string;
    status: UserMessageStatus | AssistantMessageStatus;

    // 消息元数据
    modelId?: string;
    model?: Model;
    type?: 'clear';
    isPreset?: boolean;
    useful?: boolean;
    askId?: string; // 关联的问题消息ID
    mentions?: Model[];

    usage?: Usage;
    metrics?: Metrics;

    // UI相关
    multiModelMessageStyle?: 'horizontal' | 'vertical' | 'fold' | 'grid';
    foldSelected?: boolean;

    // 块集合
    blocks: MessageBlock['id'][];
};
