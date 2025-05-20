import { BugOutlined } from '@ant-design/icons';
import { Button, Card, Form, InputNumber, message, Radio, Space, Switch } from 'antd';
import React, { useState } from 'react';

import { t } from '@/services/i18n';
import type { LoggerConfig } from '@/utils/logger';
import { clearLogs, getLoggerConfig, LogLevel, updateLoggerConfig } from '@/utils/logger';

const Logger: React.FC = () => {
    const [loggerConfig, setLoggerConfig] = useState<LoggerConfig>(getLoggerConfig());

    // Handler for clearing logs
    const handleClearLogs = async () => {
        try {
            await clearLogs();
            message.success(t('options_logging_cleared'));
        } catch (error) {
            console.error('Failed to clear logs:', error);
            message.error(t('options_logging_clear_failed'));
        }
    };

    // Handler for logging settings changes
    const handleLoggingSettingsChange = async (changedValues: any, _allValues: any) => {
        try {
            if (changedValues.logging) {
                const newConfig = await updateLoggerConfig(changedValues.logging);
                setLoggerConfig(newConfig);
                message.success(t('options_logging_settings_saved'));
            }
        } catch (error) {
            console.error('Failed to update logging settings:', error);
            message.error(t('options_logging_settings_save_failed'));
        }
    };

    return (
        <Card
            title={
                <Space>
                    <BugOutlined />
                    {t('options_logging_settings')}
                </Space>
            }
        >
            <Form
                layout="vertical"
                initialValues={{ logging: loggerConfig }}
                onValuesChange={handleLoggingSettingsChange}
            >
                <Form.Item
                    name={['logging', 'enabled']}
                    label={t('options_logging_enabled')}
                    valuePropName="checked"
                >
                    <Switch />
                </Form.Item>

                <Form.Item name={['logging', 'level']} label={t('options_logging_level')}>
                    <Radio.Group>
                        <Radio value={LogLevel.DEBUG}>{t('options_logging_level_debug')}</Radio>
                        <Radio value={LogLevel.INFO}>{t('options_logging_level_info')}</Radio>
                        <Radio value={LogLevel.WARN}>{t('options_logging_level_warn')}</Radio>
                        <Radio value={LogLevel.ERROR}>{t('options_logging_level_error')}</Radio>
                    </Radio.Group>
                </Form.Item>

                <Form.Item
                    name={['logging', 'includeTimestamp']}
                    label={t('options_logging_include_timestamp')}
                    valuePropName="checked"
                >
                    <Switch />
                </Form.Item>

                <Form.Item
                    name={['logging', 'logToConsole']}
                    label={t('options_logging_to_console')}
                    valuePropName="checked"
                >
                    <Switch />
                </Form.Item>

                <Form.Item
                    name={['logging', 'persistLogs']}
                    label={t('options_logging_persist')}
                    valuePropName="checked"
                >
                    <Switch />
                </Form.Item>

                <Form.Item
                    name={['logging', 'maxPersistedLogs']}
                    label={t('options_logging_max_persisted')}
                >
                    <InputNumber min={100} max={10000} step={100} />
                </Form.Item>

                <Form.Item>
                    <Button type="primary" danger onClick={handleClearLogs}>
                        {t('options_logging_clear')}
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default Logger;
