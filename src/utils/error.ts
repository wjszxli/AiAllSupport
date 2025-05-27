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

    return false;
};
