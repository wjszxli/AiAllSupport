export const abortMap = new Map<string, (() => void)[]>();

export const addAbortController = (id: string, abortFn: () => void) => {
    abortMap.set(id, [...(abortMap.get(id) || []), abortFn]);
};

export const removeAbortController = (id: string, abortFn: () => void) => {
    const callbackArr = abortMap.get(id);
    if (abortFn) {
        const index = callbackArr?.indexOf(abortFn);
        if (index !== undefined && index !== -1) {
            callbackArr?.splice(index, 1);
        }
    } else abortMap.delete(id);
};

export const abortCompletion = (id: string) => {
    try {
        console.log('[abortCompletion] abortMap', abortMap);
        const abortFns = abortMap.get(id);
        console.log('[abortCompletion] abortFns', abortFns);
        if (abortFns?.length) {
            // Make a copy of the array to avoid issues with concurrent modification
            const fnsToExecute = [...abortFns];
            for (const fn of fnsToExecute) {
                try {
                    fn();
                } catch (error) {
                    console.error('[abortCompletion] Error calling abort function:', error);
                } finally {
                    removeAbortController(id, fn);
                }
            }
        }
    } catch (error) {
        console.error('[abortCompletion] Error aborting completion:', error);
    }
};

export function createAbortPromise(signal: AbortSignal, finallyPromise: Promise<string>) {
    return new Promise<string>((_resolve, reject) => {
        if (signal.aborted) {
            reject(new DOMException('Operation aborted', 'AbortError'));
            return;
        }

        const abortHandler = (e: Event) => {
            console.log('[createAbortPromise] abortHandler', e);
            reject(new DOMException('Operation aborted', 'AbortError'));
        };

        signal.addEventListener('abort', abortHandler, { once: true });

        finallyPromise.finally(() => {
            signal.removeEventListener('abort', abortHandler);
        });
    });
}
