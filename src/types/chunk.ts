export type ResponseError = Record<string, any>;

export enum ChunkType {
    BLOCK_CREATED = 'block_created',
    BLOCK_IN_PROGRESS = 'block_in_progress',
    LLM_RESPONSE_CREATED = 'llm_response_created',
    LLM_RESPONSE_IN_PROGRESS = 'llm_response_in_progress',
    TEXT_DELTA = 'text.delta',
    TEXT_COMPLETE = 'text.complete',
    AUDIO_DELTA = 'audio.delta',
    AUDIO_COMPLETE = 'audio.complete',
    IMAGE_CREATED = 'image.created',
    IMAGE_DELTA = 'image.delta',
    IMAGE_COMPLETE = 'image.complete',
    THINKING_DELTA = 'thinking.delta',
    THINKING_COMPLETE = 'thinking.complete',
    LLM_WEB_SEARCH_IN_PROGRESS = 'llm_websearch_in_progress',
    LLM_WEB_SEARCH_COMPLETE = 'llm_websearch_complete',
    LLM_RESPONSE_COMPLETE = 'llm_response_complete',
    BLOCK_COMPLETE = 'block_complete',
    ERROR = 'error',
    SEARCH_IN_PROGRESS_UNION = 'search_in_progress_union',
    SEARCH_COMPLETE_UNION = 'search_complete_union',
}

export interface BlockCreatedChunk {
    /**
     * The type of the chunk
     */
    type: ChunkType.BLOCK_CREATED;
}

export interface BlockInProgressChunk {
    /**
     * The type of the chunk
     */
    type: ChunkType.BLOCK_IN_PROGRESS;

    /**
     * The response
     */
    response?: Response;
}

export interface LLMResponseCreatedChunk {
    /**
     * The response
     */
    response?: Response;

    /**
     * The type of the chunk
     */
    type: ChunkType.LLM_RESPONSE_CREATED;
}

export interface LLMResponseInProgressChunk {
    /**
     * The type of the chunk
     */
    response?: Response;
    type: ChunkType.LLM_RESPONSE_IN_PROGRESS;
}

export interface TextDeltaChunk {
    /**
     * The text content of the chunk
     */
    text: string;

    /**
     * The ID of the chunk
     */
    chunk_id?: number;

    /**
     * The type of the chunk
     */
    type: ChunkType.TEXT_DELTA;
}

export interface TextCompleteChunk {
    /**
     * The text content of the chunk
     */
    text: string;

    /**
     * The ID of the chunk
     */
    chunk_id?: number;

    /**
     * The type of the chunk
     */
    type: ChunkType.TEXT_COMPLETE;
}

export interface ThinkingDeltaChunk {
    /**
     * The text content of the chunk
     */
    text: string;

    /**
     * The thinking time of the chunk
     */
    thinking_millsec?: number;

    /**
     * The type of the chunk
     */
    type: ChunkType.THINKING_DELTA;
}

export interface ThinkingCompleteChunk {
    /**
     * The text content of the chunk
     */
    text: string;

    /**
     * The thinking time of the chunk
     */
    thinking_millsec?: number;

    /**
     * The type of the chunk
     */
    type: ChunkType.THINKING_COMPLETE;
}

export interface BlockCompleteChunk {
    /**
     * The full response
     */
    response?: Response;

    /**
     * The type of the chunk
     */
    type: ChunkType.BLOCK_COMPLETE;

    /**
     * The error
     */
    error?: ResponseError;
}

export interface ErrorChunk {
    error: ResponseError;

    type: ChunkType.ERROR;
}

export type Chunk =
    | BlockCreatedChunk // 消息块创建，无意义
    | BlockInProgressChunk // 消息块进行中，无意义
    | LLMResponseCreatedChunk // 大模型响应创建，返回即将创建的块类型
    | LLMResponseInProgressChunk // 大模型响应进行中
    | TextDeltaChunk // 文本内容生成中
    | TextCompleteChunk // 文本内容生成完成
    | ThinkingDeltaChunk // 思考内容生成中
    | ThinkingCompleteChunk // 思考内容生成完成
    | BlockCompleteChunk // 所有块创建完成，通常用于非流式处理；目前没有做区分
    | ErrorChunk; // 错误
