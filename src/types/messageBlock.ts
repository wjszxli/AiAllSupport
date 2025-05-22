import { Model } from '.';

export enum MessageBlockType {
    UNKNOWN = 'unknown', // 未知类型，用于返回之前
    MAIN_TEXT = 'main_text', // 主要文本内容
    THINKING = 'thinking', // 思考过程（Claude、OpenAI-o系列等）
    TRANSLATION = 'translation', // Re-added
    CODE = 'code', // 代码块
    TOOL = 'tool', // Added unified tool block type
    ERROR = 'error', // 错误信息
    CITATION = 'citation', // 引用类型 (Now includes web search, grounding, etc.)
}

export enum MessageBlockStatus {
    PENDING = 'pending', // 等待处理
    PROCESSING = 'processing', // 正在处理，等待接收
    STREAMING = 'streaming', // 正在流式接收
    SUCCESS = 'success', // 处理成功
    ERROR = 'error', // 处理错误
    PAUSED = 'paused', // 处理暂停
}

export interface BaseMessageBlock {
    id: string; // 块ID
    messageId: string; // 所属消息ID
    type: MessageBlockType; // 块类型
    createdAt: string; // 创建时间
    updatedAt?: string; // 更新时间
    status: MessageBlockStatus; // 块状态
    model?: Model; // 使用的模型
    metadata?: Record<string, any>; // 通用元数据
    error?: Record<string, any>; // Added optional error field to base
}

export interface PlaceholderMessageBlock extends BaseMessageBlock {
    type: MessageBlockType.UNKNOWN;
}

export interface MainTextMessageBlock extends BaseMessageBlock {
    type: MessageBlockType.MAIN_TEXT;
    content: string;
    knowledgeBaseIds?: string[];
}

export interface ThinkingMessageBlock extends BaseMessageBlock {
    type: MessageBlockType.THINKING;
    content: string;
    thinking_millsec?: number;
}

export interface CodeMessageBlock extends BaseMessageBlock {
    type: MessageBlockType.CODE;
    content: string;
    language: string; // 代码语言
}

export interface ErrorMessageBlock extends BaseMessageBlock {
    type: MessageBlockType.ERROR;
}

export type MessageBlock =
    | PlaceholderMessageBlock
    | MainTextMessageBlock
    | ThinkingMessageBlock
    | CodeMessageBlock
    | ErrorMessageBlock;
