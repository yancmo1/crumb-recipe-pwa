import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(() => {
  // Used for cache-busting PWA icons/manifest across deployments.
  // In CI we pass this via Docker build args; in dev you can set it in .env.
  const assetVersion = (process.env.VITE_ASSET_VERSION || '').trim();
  const iconQuery = assetVersion ? `?v=${assetVersion.slice(0, 12)}` : '';

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
      ],
      manifest: {
        name: 'Crumb - Recipe Manager',
        short_name: 'Crumb',
        description: 'Offline-friendly recipe PWA for home cooks',
        theme_color: '#7C8FB2',
        background_color: '#F2EFEA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: `pwa-192x192.png${iconQuery}`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `pwa-512x512.png${iconQuery}`,
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: `pwa-512x512.png${iconQuery}`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
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