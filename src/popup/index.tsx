import './App.scss';

import { createRoot } from 'react-dom/client';
import React, { createContext } from 'react';

import App from './App';
import { LanguageProvider } from '../contexts/LanguageContext';
import rootStore from '@/store';

const container = document.getElementById('root');

const root = createRoot(container!);
const StoreContext = createContext(rootStore);

root.render(
    <React.StrictMode>
        <StoreContext.Provider value={rootStore}>
            <LanguageProvider>
                <App />
            </LanguageProvider>
        </StoreContext.Provider>
    </React.StrictMode>,
);
