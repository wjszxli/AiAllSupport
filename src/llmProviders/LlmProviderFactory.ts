import { Provider } from '@/types';
import OpenAiLlmProvider from './OpenAiLlmProvider';

export default class LlmProviderFactory {
    static create(provider: Provider) {
        switch (provider.id) {
            case 'openai':
                return new OpenAiLlmProvider(provider);
            default:
                return new OpenAiLlmProvider(provider);
        }
    }
}
