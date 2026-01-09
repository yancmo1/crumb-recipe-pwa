import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(() => {
  // NOTE: Avoid adding query params to icon URLs.
  // In some WebKit environments, the browser can emit noisy privacy warnings like:
  //   "Unable to hide query parameters from script (missing data)"
  // and query-string icons aren't needed anyway.
  // (Service worker updates already handle cache invalidation for web.)

  return {
    plugins: [
      react(),
      VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,webmanifest}'],
      },
      includeAssets: [
        'favicon.ico',
        'masked-icon.svg',
        'apple-touch-icon.png',
        'apple-touch-icon-152x152.png',
        'apple-touch-icon-167x167.png',
        'apple-touch-icon-180x180.png',
        'crumbworks-1024x1024.png',
      ],
      manifest: {
        name: 'CrumbWorks',
        short_name: 'CrumbWorks',
        description: 'Offline-friendly recipe and timer vault for home cooks and family sharing',
        theme_color: '#162841',
        background_color: '#F7F3EE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'crumbworks-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'crumbworks-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'crumbworks-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'crumbworks-1024x1024.png',
            sizes: '1024x1024',
            type: 'image/png',
          },
        ],
        share_target: {
          action: '/import',
          method: 'GET',
          enctype: 'application/x-www-form-urlencoded',
          params: {
            url: 'url',
          },
        },
      },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          // Useful for Docker dev: set VITE_API_PROXY_TARGET=http://api:5555
          // Default keeps existing local dev behavior.
          target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});