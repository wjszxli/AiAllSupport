import { useCallback } from 'react';
import { message as AntdMessage } from 'antd';
import robotStore from '@/store/robot';
import llmStore from '@/store/llm';
import rootStore from '@/store';
import { InputMessage, getUserMessage } from '@/utils/message/input';
import { getMessageService } from '@/services/MessageService';
import { ConfigModelType, Robot } from '@/types';
import { Logger } from '@/utils/logger';

const logger = new Logger('useMessageSender');

export const useMessageSender = () => {
    const handleSendMessage = useCallback(
        async ({
            userInput,
            robot,
            onSuccess,
            interfaceType = ConfigModelType.CHAT,
        }: {
            userInput: string;
            robot?: Robot;
            onSuccess?: () => void;
            interfaceType?: ConfigModelType;
        }) => {
            if (!userInput.trim()) return;

            const selectedRobot = robot || robotStore?.selectedRobot;
            logger.debug('robot', selectedRobot);
            const { selectedTopicId } = selectedRobot;

            if (!selectedTopicId) {
                AntdMessage.error('请先选择一个话题');
                return;
            }

            // 使用指定界面类型的模型
            selectedRobot.model = llmStore.getModelForType(interfaceType);
            logger.debug(`Using ${interfaceType} model:`, selectedRobot.model);

            const topic = selectedRobot.topics.find((topic) => topic.id === selectedTopicId);

            if (!topic) {
                AntdMessage.error('请先选择一个话题');
                return;
            }

            // Web search and webpage context are now handled by LangChain tools automatically
            // No need for manual search and prompt construction
            const finalUserInput = userInput;

            const userMessage: InputMessage = {
                robot: selectedRobot,
                topic: topic,
                content: finalUserInput,
            };

            const { message, blocks } = getUserMessage(userMessage);

            const messageService = getMessageService(rootStore);
            messageService.sendMessage(message, blocks, selectedRobot, selectedTopicId);

            // 调用成功回调
            if (onSuccess) {
                onSuccess();
            }
        },
        [],
    );

    return {
        handleSendMessage,
    };
};
