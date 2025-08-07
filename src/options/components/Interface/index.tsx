import { Form, Switch } from 'antd';
import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';

import { t } from '@/locales/i18n';
import rootStore from '@/store';

interface InterfaceProps {
    form: any;
}

const Interface: React.FC<InterfaceProps> = observer(({ form }) => {
    const { settingStore } = rootStore;

    const onIsIconChange = (checked: boolean) => {
        settingStore.setIsChatBoxIcon(checked);
    };

    const initData = async () => {
        form.setFieldsValue({
            isIcon: settingStore.isChatBoxIcon,
            useWebpageContext: settingStore.useWebpageContext,
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
                initialValue={settingStore.isChatBoxIcon}
                tooltip={t('showIconTooltip')}
            >
                <Switch
                    onChange={(checked) => onIsIconChange(checked)}
                    id="tour-selection-toolbar"
                />
            </Form.Item>

            <Form.Item
                className="form-item"
                label={t('includeWebpage')}
                name="useWebpageContext"
                valuePropName="checked"
                initialValue={settingStore.useWebpageContext}
                tooltip={t('includeWebpageTooltip')}
            >
                <Switch
                    onChange={(checked) => {
                        settingStore.setUseWebpageContext(checked);
                    }}
                    id="tour-webpage-context"
                />
            </Form.Item>
        </Form>
    );
});

export default Interface;
