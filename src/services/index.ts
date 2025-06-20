import { t } from '@/locales/i18n';
import { ConfigModelType, IMessage } from '@/types';
import { getModelForInterface, requestAIStream, requestApi } from '@/utils';
import { SERVICE_MAP } from '@/utils/constant';
import storage from '@/utils/storage';

export const validateApiKey = async () => {
    const { selectedModel, selectedProvider } = await storage.getConfig();

    if (!selectedProvider || !(selectedProvider in SERVICE_MAP)) {
        throw new Error(t('selectProvider'));
    }

    const url = SERVICE_MAP[selectedProvider as keyof typeof SERVICE_MAP].chat;
    const data = {
        model: selectedModel,
        messages: [{ role: 'user', content: 'test' }],
        stream: false,
    };
    return requestApi(url, 'POST', data);
};

export const chat = async (messages: IMessage[], interfaceType = ConfigModelType.CHAT) => {
    const model = getModelForInterface(interfaceType);
    const selectedProvider = model.provider;

    if (!selectedProvider || !(selectedProvider in SERVICE_MAP)) {
        throw new Error(t('selectProvider'));
    }
    const url = SERVICE_MAP[selectedProvider as keyof typeof SERVICE_MAP].chat;
    const data = {
        model: model.id,
        messages: [{ role: 'system', content: t('systemPrompt') }, ...messages],
        stream: true,
    };
    return requestApi(url, 'POST', data);
};

export const modelList = async (selectedProvider: string) => {
    if (!selectedProvider || !(selectedProvider in SERVICE_MAP)) {
        throw new Error(t('selectProvider'));
    }
    const service = SERVICE_MAP[selectedProvider as keyof typeof SERVICE_MAP];
    if (!('modelList' in service)) {
        throw new Error(t('modelListNotSupported'));
    }
    const url = service.modelList;
    return requestApi(url);
};

export const chatAIStream = async (
    messages: IMessage[],
    onData: (chunk: { data: string; done: boolean }) => void,
    tabId?: string | null,
    interfaceType = ConfigModelType.CHAT,
) => {
    const model = getModelForInterface(interfaceType);
    const selectedProvider = model.provider;

    if (!selectedProvider || !(selectedProvider in SERVICE_MAP)) {
        throw new Error(t('selectProvider'));
    }
    const url = SERVICE_MAP[selectedProvider as keyof typeof SERVICE_MAP].chat;
    console.log(`Using ${interfaceType} model:`, model);

    const data = {
        model: model.id,
        messages: [{ role: 'system', content: t('systemPrompt') }, ...messages],
        stream: true,
    };
    return requestAIStream(url, 'POST', data, onData, tabId);
};
