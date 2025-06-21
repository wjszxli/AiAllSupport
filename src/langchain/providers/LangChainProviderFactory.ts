import { Provider } from '@/types';
import BaseLangChainProvider from './BaseLangChainProvider';
import DeepSeekLangChainProvider from './DeepSeekLangChainProvider';
import OpenAiLangChainProvider from './OpenAiLangChainProvider';
import OllamaLangChainProvider from './OllamaLangChainProvider';
import { getLogger } from 'loglevel';

const logger = getLogger('LangChainProviderFactory');
export default class LangChainProviderFactory {
    static create(provider: Provider): BaseLangChainProvider {
        const { selectedModel } = provider;

        if (provider.id === 'ollama') {
            console.log('Creating OllamaLangChainProvider');
            return new OllamaLangChainProvider(provider);
        }

        if (selectedModel?.id.includes('deepseek')) {
            console.log('Creating DeepSeekLangChainProvider');
            return new DeepSeekLangChainProvider(provider);
        }

        console.log('Creating OpenAiLangChainProvider');
        return new OpenAiLangChainProvider(provider);
    }
}
