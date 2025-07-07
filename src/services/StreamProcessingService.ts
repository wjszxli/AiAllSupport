import { RobotMessageStatus } from '@/types';
import type { Chunk} from '@/types/chunk';
import { ChunkType } from '@/types/chunk';
import { Logger } from '@/utils/logger';

// Create a logger for this module
const logger = new Logger('StreamProcessingService');

export interface StreamProcessorCallbacks {
    // LLM response created
    onLLMResponseCreated?: () => void;
    // Text content chunk received
    onTextChunk?: (text: string) => void;
    // Full text content received
    onTextComplete?: (text: string) => void;
    // Thinking/reasoning content chunk received (e.g., from Claude)
    onThinkingChunk?: (text: string, thinking_millsec?: number) => void;
    onThinkingComplete?: (text: string, thinking_millsec?: number) => void;
    // Called when an error occurs during chunk processing
    onError?: (error: any) => void;
    // Called when the entire stream processing is signaled as complete (success or failure)
    onComplete?: (status: RobotMessageStatus, response?: Response) => void;
}

export function createStreamProcessor(callbacks: StreamProcessorCallbacks = {}) {
    // The returned function processes a single chunk or a final signal
    return (chunk: Chunk) => {
        try {
            // Logger.log(`[${new Date().toLocaleString()}] createStreamProcessor ${chunk.type}`, chunk)
            // 1. Handle the manual final signal first
            if (chunk?.type === ChunkType.BLOCK_COMPLETE) {
                callbacks.onComplete?.(RobotMessageStatus.SUCCESS, chunk?.response);
                return;
            }
            // 2. Process the actual ChunkCallbackData
            const data = chunk; // Cast after checking for 'final'
            // Invoke callbacks based on the fields present in the chunk data
            if (data.type === ChunkType.LLM_RESPONSE_CREATED && callbacks.onLLMResponseCreated) {
                callbacks.onLLMResponseCreated();
            }
            if (data.type === ChunkType.TEXT_DELTA && callbacks.onTextChunk) {
                callbacks.onTextChunk(data.text);
            }
            if (data.type === ChunkType.TEXT_COMPLETE && callbacks.onTextComplete) {
                callbacks.onTextComplete(data.text);
            }
            if (data.type === ChunkType.THINKING_DELTA && callbacks.onThinkingChunk) {
                callbacks.onThinkingChunk(data.text);
            }
            if (data.type === ChunkType.THINKING_COMPLETE && callbacks.onThinkingComplete) {
                callbacks.onThinkingComplete(data.text, data.thinking_millsec);
            }
        } catch (error) {
            logger.error('Error processing stream chunk:', error);
            callbacks.onError?.(error);
        }
    };
}
