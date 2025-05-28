import { useCallback } from 'react';

export const usePromptSuggestions = () => {
    // 这里可以从配置或API获取建议提示词
    const defaultSuggestions = [
        '你能做什么？',
        '帮我解释一下React的生命周期',
        '如何使用TypeScript？',
        '写一个简单的Todo应用',
    ];

    const handleSelectPrompt = useCallback((prompt: string, onSelect: (text: string) => void) => {
        onSelect(prompt);
    }, []);

    return {
        suggestedPrompts: defaultSuggestions,
        handleSelectPrompt,
    };
};
