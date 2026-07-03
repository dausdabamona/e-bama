import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { pasangSinkronOtomatis } from './lib/sync';

// Sinkron antrian offline otomatis saat aplikasi dibuka / kembali online
pasangSinkronOtomatis();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
