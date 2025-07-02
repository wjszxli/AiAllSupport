import { useCallback, useState, useEffect } from 'react';
import promptData from '@/config/prompt.json';

interface PromptItem {
    category: string;
    prompt: string;
}

export const usePromptSuggestions = () => {
    const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);

    // Fisher-Yates 洗牌算法，确保公平随机
    const shuffleArray = useCallback(<T>(array: T[]): T[] => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }, []);

    // 生成随机提示词
    const generateRandomPrompts = useCallback(() => {
        const prompts = promptData as PromptItem[];

        if (!prompts || prompts.length === 0) {
            return [
                '你能做什么？',
                '帮我解释一下React的生命周期',
                '如何使用TypeScript？',
                '写一个简单的Todo应用',
            ];
        }

        // 洗牌并选择前6个
        const shuffledPrompts = shuffleArray(prompts);
        const selectedPrompts = shuffledPrompts.slice(0, 6);

        return selectedPrompts.map((item) => item.prompt);
    }, [shuffleArray]);

    // 组件挂载时生成随机提示词
    useEffect(() => {
        const randomPrompts = generateRandomPrompts();
        setSuggestedPrompts(randomPrompts);
    }, [generateRandomPrompts]);

    const handleSelectPrompt = useCallback((prompt: string, onSelect: (text: string) => void) => {
        onSelect(prompt);
    }, []);

    return {
        suggestedPrompts,
        handleSelectPrompt,
        refreshPrompts: () => {
            const randomPrompts = generateRandomPrompts();
            setSuggestedPrompts(randomPrompts);
        },
    };
};
