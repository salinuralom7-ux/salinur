import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DataProvider } from './store/DataContext';
import Root from './Root';
import { registerSW } from './pwa';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataProvider>
      <Root />
    </DataProvider>
  </StrictMode>,
);

registerSW();
