import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Robot } from '@/types';

export function createChatPromptTemplate(robot: Robot) {
    return ChatPromptTemplate.fromMessages([
        ['system', robot.prompt || 'You are a helpful assistant.'],
        ['human', '{input}'],
    ]);
}
