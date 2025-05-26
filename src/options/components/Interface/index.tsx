import { Form, Switch } from 'antd';
import React, { useEffect } from 'react';

import { t } from '@/locales/i18n';
import storage from '@/utils/storage';

interface InterfaceProps {
    form: any;
}

const Interface: React.FC<InterfaceProps> = ({ form }) => {
    const onIsIconChange = (checked: boolean) => {
        storage.setIsChatBoxIcon(checked);
    };

    const initData = async () => {
        const isChatBoxIcon = await storage.getIsChatBoxIcon();
        const isUseWebpageContext = await storage.getUseWebpageContext();
        form.setFieldsValue({
            isIcon: isChatBoxIcon,
            useWebpageContext: isUseWebpageContext,
        });
    };

    useEffect(() => {
        initData();
    }, []);

    return (
        <Form form={form} name="setting">
            <Form.Item
                className="form-item"
                label={t('showIcon')}
                name="isIcon"
                valuePropName="checked"
                initialValue={true}
                tooltip={t('showIconTooltip')}
            >
                <Switch onChange={(checked) => onIsIconChange(checked)} />
            </Form.Item>

            <Form.Item
                className="form-item"
                label={t('includeWebpage')}
                name="useWebpageContext"
                valuePropName="checked"
                initialValue={true}
                tooltip={t('includeWebpageTooltip')}
            >
                <Switch
                    onChange={(checked) => {
                        storage.setUseWebpageContext(checked);
                    }}
                />
            </Form.Item>
        </Form>
    );
};

export default Interface;
