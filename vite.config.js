import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'splash.jpg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Banca Rusa - Crapette',
        short_name: 'Banca Rusa',
        description: 'Juego de cartas Banca Rusa (Crapette)',
        theme_color: '#1a472a',
        background_color: '#1a1a1a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg}'],
        globIgnores: ['splash-ios.png'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      }
    })
  ],
})
