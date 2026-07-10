import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/error-boundary';
import './index.css';
import { pasangSinkronOtomatis } from './lib/sync';

// Sinkron antrian offline otomatis saat aplikasi dibuka / kembali online
pasangSinkronOtomatis();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
