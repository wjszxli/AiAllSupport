import { Provider } from '@/types';
import BaseLangChainProvider from './BaseLangChainProvider';
import OpenAiLangChainProvider from './OpenAiLangChainProvider';
import DeepSeekLangChainProvider from './DeepSeekLangChainProvider';
import OllamaLangChainProvider from './OllamaLangChainProvider';
import type { RootStore } from '@/store';

export default class LangChainProviderFactory {
    static create(provider: Provider, rootStore?: RootStore): BaseLangChainProvider {
        const { selectedModel } = provider;

        if (provider.id === 'ollama') {
            console.log('Creating OllamaLangChainProvider');
            return new OllamaLangChainProvider(provider, rootStore);
        }

        if (selectedModel?.id.includes('deepseek')) {
            console.log('Creating DeepSeekLangChainProvider');
            return new DeepSeekLangChainProvider(provider, rootStore);
        }

        console.log('Creating OpenAiLangChainProvider');
        return new OpenAiLangChainProvider(provider, rootStore);
    }
}
