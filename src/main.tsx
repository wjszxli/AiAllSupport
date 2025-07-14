import { initLogger, Logger } from '@/utils/logger';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './chat/App';
import './index.css';
import './utils/debugDatabase'; // 导入调试工具
import { LanguageProvider } from './contexts/LanguageContext';

// 延迟创建Logger实例，避免初始化顺序问题
let logger: Logger;

// 初始化Logger
initLogger()
    .then((config) => {
        // 在initLogger完成后创建Logger实例
        logger = new Logger('main-app');
        logger.debug('Main app logger initialized', config);
    })
    .catch((error) => {
        console.error('Failed to initialize logger in main app:', error);
    });

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

root.render(
    <React.StrictMode>
        <LanguageProvider>
            <App />
        </LanguageProvider>
    </React.StrictMode>,
);
