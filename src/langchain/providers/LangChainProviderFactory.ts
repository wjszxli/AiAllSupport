import { Provider } from '@/types';
import BaseLangChainProvider from './BaseLangChainProvider';
import OpenAiLangChainProvider from './OpenAiLangChainProvider';
import DeepSeekLangChainProvider from './DeepSeekLangChainProvider';
import OllamaLangChainProvider from './OllamaLangChainProvider';
import type { RootStore } from '@/store';
import { Logger } from '@/utils/logger';

const logger = new Logger('LangChainProviderFactory');

export default class LangChainProviderFactory {
    static create(provider: Provider, rootStore?: RootStore): BaseLangChainProvider {
        const { selectedModel } = provider;

        if (provider.id === 'ollama') {
            logger.info('Creating OllamaLangChainProvider');
            return new OllamaLangChainProvider(provider, rootStore);
        }

        if (selectedModel?.id.includes('deepseek')) {
            logger.info('Creating DeepSeekLangChainProvider');
            return new DeepSeekLangChainProvider(provider, rootStore);
        }

        logger.info('Creating OpenAiLangChainProvider');
        return new OpenAiLangChainProvider(provider, rootStore);
    }
}
