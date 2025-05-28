import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './chat/App';
import './index.css';
import './utils/debugDatabase'; // 导入调试工具

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
