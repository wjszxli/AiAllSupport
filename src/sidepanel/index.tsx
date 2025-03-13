import React from 'react';
import ReactDOM from 'react-dom/client';
import SidePanel from './SidePanel';
import '../styles/sidepanel.scss';
import { LanguageProvider } from '../contexts/LanguageContext';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <LanguageProvider>
      <SidePanel />
    </LanguageProvider>
  </React.StrictMode>
); 