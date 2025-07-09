import { initLogger, Logger } from '@/utils/logger';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import React, { createContext } from 'react';

import App from './App';
import { LanguageProvider } from '../contexts/LanguageContext';

import './App.scss';
import rootStore from '@/store';

// 延迟创建Logger实例，避免初始化顺序问题
let logger: Logger;

// 初始化Logger
initLogger()
    .then((config) => {
        // 在initLogger完成后创建Logger实例
        logger = new Logger('options');
        logger.info('Options logger initialized', config);
    })
    .catch((error) => {
        console.error('Failed to initialize logger in options:', error);
    });

const container = document.getElementById('root');
const root = createRoot(container!);
const StoreContext = createContext(rootStore);

root.render(
    <React.StrictMode>
        <StoreContext.Provider value={rootStore}>
            <LanguageProvider>
                <HashRouter>
                    <App />
                </HashRouter>
            </LanguageProvider>
        </StoreContext.Provider>
    </React.StrictMode>,
);
