import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import React, { createContext } from 'react';

import App from './App';
import { LanguageProvider } from '../contexts/LanguageContext';

import './App.scss';
import rootStore from '@/store';

const container = document.getElementById('root');
const root = createRoot(container!);
const StoreContext = createContext(rootStore);

root.render(
    <React.StrictMode>
        <LanguageProvider>
            <StoreContext.Provider value={rootStore}>
                <HashRouter>
                    <App />
                </HashRouter>
            </StoreContext.Provider>
        </LanguageProvider>
    </React.StrictMode>,
);
