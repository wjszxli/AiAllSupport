import { useCallback } from 'react';
import { message as AntdMessage } from 'antd';
import robotStore from '@/store/robot';
import llmStore from '@/store/llm';
import rootStore from '@/store';
import { InputMessage, getUserMessage } from '@/utils/message/input';
import { getMessageService } from '@/services/MessageService';

export const useMessageSender = () => {
    const handleSendMessage = useCallback((userInput: string, onSuccess?: () => void) => {
        if (!userInput.trim()) return;

        const { selectedRobot } = robotStore;
        const { selectedTopicId } = selectedRobot;

        if (!selectedTopicId) {
            AntdMessage.error('请先选择一个话题');
            return;
        }

        selectedRobot.model = llmStore.defaultModel;

        const topic = robotStore.selectedRobot.topics.find((topic) => topic.id === selectedTopicId);

        if (!topic) {
            AntdMessage.error('请先选择一个话题');
            return;
        }

        const userMessage: InputMessage = {
            robot: selectedRobot,
            topic: topic,
            content: userInput,
        };

        const { message, blocks } = getUserMessage(userMessage);
        console.log(message, blocks);

        // 使用独立的 MessageService
        const messageService = getMessageService(rootStore);
        messageService.sendMessage(message, blocks, selectedRobot, selectedTopicId);

        // 调用成功回调
        if (onSuccess) {
            onSuccess();
        }
    }, []);

    return {
        handleSendMessage,
    };
};
