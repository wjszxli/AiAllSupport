import { Provider } from '@/types';
// import OpenAiLangChainProvider from './OpenAiLangChainProvider';
import BaseLangChainProvider from './BaseLangChainProvider';
import DeepSeekLangChainProvider from './DeepSeekLangChainProvider';

export default class LangChainProviderFactory {
    static create(provider: Provider): BaseLangChainProvider {
        console.log('provider', provider);
        switch (provider.id) {
            case 'openai':
                return new DeepSeekLangChainProvider(provider);
            default:
                return new DeepSeekLangChainProvider(provider);
        }
    }
}
