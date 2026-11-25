import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// BASE_PATH wird beim GitHub-Pages-Build gesetzt (z. B. /Schreibwerkstatt/)
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  build: { chunkSizeWarningLimit: 2000 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Schreibwerkstatt',
        short_name: 'Schreibwerkstatt',
        description: 'Schreiben, planen, synchronisieren – auf iPad und PC.',
        lang: 'de',
        theme_color: '#9a5b2e',
        background_color: '#f6f3ee',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})
