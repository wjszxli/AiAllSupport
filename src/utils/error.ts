export const isAbortError = (error: any): boolean => {
    // 检查错误消息
    if (error?.message === 'Request was aborted.') {
        return true;
    }

    // 检查是否为 DOMException 类型的中止错误
    if (error instanceof DOMException && error.name === 'AbortError') {
        return true;
    }

    // 检查 OpenAI 特定的错误结构
    if (
        error &&
        typeof error === 'object' &&
        (error.message === 'Request was aborted.' ||
            error?.message?.includes('signal is aborted without reason'))
    ) {
        return true;
    }

    // 检查 BaseLlmProvider 的中止错误
    if (error?.message === 'Operation aborted') {
        return true;
    }

    // 检查常见的中止错误消息
    if (
        error &&
        typeof error === 'object' &&
        error.message &&
        (error.message.includes('abort') || error.message.includes('cancel'))
    ) {
        return true;
    }

    return false;
};

/**
 * Logs an error with its stack trace
 * @param context The context where the error occurred
 * @param message A message describing the error
 * @param error The error object
 */
export const logErrorWithStack = (context: string, message: string, error: any): void => {
    console.error(`[${context}] ${message}:`, error);
    console.error(
        'Stack trace:',
        error instanceof Error ? error.stack : 'No stack trace available',
    );
};

/**
 * Creates a standardized error object with additional context
 * @param message The error message
 * @param code Optional error code
 * @param originalError The original error that caused this error
 */
export class AppError extends Error {
    code?: string;
    originalError?: Error;

    constructor(message: string, code?: string, originalError?: Error) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.originalError = originalError;

        // Ensure the stack trace is captured properly
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }

    /**
     * Logs this error with its stack trace
     * @param context The context where the error occurred
     */
    log(context: string): void {
        logErrorWithStack(context, this.message, this);
        if (this.originalError) {
            console.error('Original error:', this.originalError);
            console.error(
                'Original stack trace:',
                this.originalError.stack || 'No stack trace available',
            );
        }
    }
}
