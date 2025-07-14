import type { Model } from '.';

export enum MessageBlockType {
    UNKNOWN = 'unknown', // 未知类型，用于返回之前
    MAIN_TEXT = 'main_text', // 主要文本内容
    THINKING = 'thinking', // 思考过程（Claude、OpenAI-o系列等）
    TRANSLATION = 'translation', // Re-added
    CODE = 'code', // 代码块
    TOOL = 'tool', // Added unified tool block type
    ERROR = 'error', // 错误信息
    INTERRUPTED = 'interrupted', // 中断状态
    CITATION = 'citation', // 引用类型 (Now includes web search, grounding, etc.)
    SEARCH_STATUS = 'search_status', // 搜索状态块
    SEARCH_RESULTS = 'search_results', // 搜索结果块
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

export interface InterruptedMessageBlock extends BaseMessageBlock {
    type: MessageBlockType.INTERRUPTED;
    content?: string; // 可选的中断前的内容
}

export interface SearchStatusMessageBlock extends BaseMessageBlock {
    type: MessageBlockType.SEARCH_STATUS;
    query: string; // 搜索查询
    engine?: string; // 搜索引擎名称
}

export interface SearchResultsMessageBlock extends BaseMessageBlock {
    type: MessageBlockType.SEARCH_RESULTS;
    query: string; // 搜索查询
    results: Array<{
        title: string;
        url: string;
        snippet: string;
        domain: string;
    }>;
    engine: string; // 搜索引擎名称
    contentFetched?: boolean; // 是否获取了内容
}

export type MessageBlock =
    | PlaceholderMessageBlock
    | MainTextMessageBlock
    | ThinkingMessageBlock
    | CodeMessageBlock
    | ErrorMessageBlock
    | InterruptedMessageBlock
    | SearchStatusMessageBlock
    | SearchResultsMessageBlock;
