import { initLogger, Logger } from '@/utils/logger';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import App from './App';
import { LanguageProvider } from '@/contexts/LanguageContext';

import './App.scss';

// 延迟创建Logger实例，避免初始化顺序问题
let logger: Logger;

// 初始化Logger
initLogger()
    .then((config) => {
        // 在initLogger完成后创建Logger实例
        logger = new Logger('install');
        logger.info('Install page logger initialized', config);
    })
    .catch((error) => {
        console.error('Failed to initialize logger in install page:', error);
    });

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <LanguageProvider>
            <HashRouter>
                <App />
            </HashRouter>
        </LanguageProvider>,
    );
}
