import { message } from 'antd';
import storage from './storage';

export const featureSettings = {
    /**
     * Toggle web search feature with mutual exclusivity check
     * @param checked New state
     * @param t Translation function for messages
     * @returns Promise resolving to the actual applied state
     */
    toggleWebSearch: async (checked: boolean, t: Function): Promise<boolean> => {
        if (checked) {
            const useWebpageContext = await storage.getUseWebpageContext();
            if (useWebpageContext) {
                message.warning(t('exclusiveFeatureError'));
                return false;
            }
        }

        await storage.setWebSearchEnabled(checked);
        return checked;
    },

    /**
     * Toggle webpage context feature with mutual exclusivity check
     * @param checked New state
     * @param t Translation function for messages
     * @returns Promise resolving to the actual applied state
     */
    toggleWebpageContext: async (checked: boolean, t: Function): Promise<boolean> => {
        if (checked) {
            const webSearchEnabled = await storage.getWebSearchEnabled();
            if (webSearchEnabled) {
                message.warning(t('exclusiveFeatureError'));
                return false;
            }
        }

        await storage.setUseWebpageContext(checked);
        return checked;
    },

    /**
     * Validate and submit form values with mutual exclusivity check for features
     * @param values Form values
     * @param t Translation function for messages
     * @returns Promise<boolean> indicating if validation passed
     */
    validateAndSubmitSettings: async (values: any, t: Function): Promise<boolean> => {
        const { webSearchEnabled, useWebpageContext } = values;

        if (webSearchEnabled && useWebpageContext) {
            message.error(t('exclusiveFeatureError'));
            return false;
        }

        return true;
    },
};
