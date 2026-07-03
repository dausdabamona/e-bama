import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base '/e-bama/' — wajib untuk GitHub Pages (dausdabamona.github.io/e-bama/)
export default defineConfig({
  base: '/e-bama/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'e-BAMA — Bantuan Uang Makan Taruna',
        short_name: 'e-BAMA',
        description: 'Manajemen bantuan uang makan taruna Politeknik KP Sorong',
        lang: 'id',
        theme_color: '#0d9488',
        background_color: '#FFFDF7',
        display: 'standalone',
        start_url: '/e-bama/',
        scope: '/e-bama/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Cache app shell; data API TIDAK di-cache service worker (ditangani Dexie)
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/e-bama/index.html'
      }
    })
  ]
});
