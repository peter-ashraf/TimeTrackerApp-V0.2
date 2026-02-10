import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// vite.config.js
export default defineConfig({
  base: '/TimeTrackerApp-V0.2/',
  
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'networkFirst',
      // Let Vite PWA generate the service worker
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'TimeTracker App',
        short_name: 'TimeTracker',
        description: 'Employee timesheet tracker with offline support',
        theme_color: '#208589',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/TimeTrackerApp-V0.2/', 
        start_url: '/TimeTrackerApp-V0.2/',
        icons: [
          {
            src: 'icons/adaptive-icon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/adaptive-icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: [],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 365 * 24 * 60 * 60 // 365 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        importScripts: ['/offline-sw.js']
      }
    })
  ],
  server: {
    hmr: {
      overlay: false  // Disable HMR overlay to prevent React hook order issues
    }
  }
})