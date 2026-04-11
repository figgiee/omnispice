import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    // Plan 05-10: PWA / offline support.
    //
    // `registerType: 'autoUpdate'` means a new build takes effect on the
    // next reload (no user prompt required). `globPatterns` must include
    // `wasm` because workbox's default pattern list excludes it — without
    // this the ngspice binary would never be precached and the very first
    // offline simulation would fail.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      workbox: {
        // Explicit file extensions include WASM (default excludes it)
        globPatterns: ['**/*.{js,css,html,wasm,ttf,woff2}'],
        // ngspice WASM can be 5-10MB — raise the precache file size cap
        // so workbox will accept it.
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /\/api\/components\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'components' },
          },
          {
            urlPattern: /\/api\/circuits\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'circuits',
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /\.wasm$/,
            handler: 'CacheFirst',
            options: { cacheName: 'wasm-modules-v1' },
          },
        ],
      },
      manifest: {
        name: 'OmniSpice',
        short_name: 'OmniSpice',
        description: 'Web-based SPICE circuit simulator for universities',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      devOptions: {
        // Disable the SW in dev — it interferes with HMR and the WASM
        // worker's SharedArrayBuffer fallback detection.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  worker: {
    plugins: () => [wasm()],
  },
});
