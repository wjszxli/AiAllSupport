import { initLogger, Logger } from '@/utils/logger';
import { createRoot } from 'react-dom/client';
import React from 'react';

import SidePanel from './SidePanel';
import '../styles/sidepanel.scss';
import { LanguageProvider } from '../contexts/LanguageContext';

// 延迟创建Logger实例，避免初始化顺序问题
let logger: Logger;

// 初始化Logger
initLogger()
    .then((config) => {
        // 在initLogger完成后创建Logger实例
        logger = new Logger('sidepanel');
        logger.info('Sidepanel logger initialized', config);
    })
    .catch((error) => {
        console.error('Failed to initialize logger in sidepanel:', error);
    });

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

root.render(
    <React.StrictMode>
        <LanguageProvider>
            <SidePanel />
        </LanguageProvider>
    </React.StrictMode>,
);
