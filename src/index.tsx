import React, { createContext, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './popup/App';
import { LanguageProvider } from './contexts/LanguageContext';
import rootStore from '@/store';
import initializeDatabase from '@/db/init';

const container = document.getElementById('root');
const root = createRoot(container!);
const StoreContext = createContext(rootStore);

// Initialize the database before rendering the app
const AppWithDatabaseInit = () => {
    const [dbInitialized, setDbInitialized] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                await initializeDatabase();
                setDbInitialized(true);
            } catch (error) {
                console.error('Failed to initialize database:', error);
                setInitError('数据库初始化失败，请刷新页面重试');
            }
        };

        init();
    }, []);

    if (initError) {
        return <div className="db-init-error">{initError}</div>;
    }

    if (!dbInitialized) {
        return <div className="db-init-loading">Loading...</div>;
    }

    return (
        <StoreContext.Provider value={rootStore}>
            <LanguageProvider>
                <App />
            </LanguageProvider>
        </StoreContext.Provider>
    );
};

root.render(
    <React.StrictMode>
        <AppWithDatabaseInit />
    </React.StrictMode>,
);
