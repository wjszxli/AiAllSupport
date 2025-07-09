import './App.scss';

import { createRoot } from 'react-dom/client';
import React, { createContext } from 'react';

import App from './App';
import { LanguageProvider } from '../contexts/LanguageContext';
import rootStore from '@/store';
import { initLogger, Logger } from '@/utils/logger';

const container = document.getElementById('root');

const root = createRoot(container!);
const StoreContext = createContext(rootStore);

// 延迟创建Logger实例，避免初始化顺序问题
let logger: Logger;

// 初始化Logger
initLogger()
    .then((config) => {
        // 在initLogger完成后创建Logger实例
        logger = new Logger('popup');
        logger.info('Popup logger initialized', config);
    })
    .catch((error) => {
        console.error('Failed to initialize logger in popup:', error);
    });

root.render(
    <React.StrictMode>
        <StoreContext.Provider value={rootStore}>
            <LanguageProvider>
                <App />
            </LanguageProvider>
        </StoreContext.Provider>
    </React.StrictMode>,
);
