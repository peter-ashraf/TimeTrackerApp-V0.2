import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/TimeTrackerApp-V0.2/',  // ← Your repo name!
  
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'TimeTracker App',
        short_name: 'TimeTracker',
        description: 'Employee timesheet tracker',
        theme_color: '#208589',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',  // ← iPhone fix #1
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
 globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
 runtimeCaching: [{
    urlPattern: ({ url }) => url.origin === location.origin,  
    handler: 'NetworkFirst',
    options: {
      cacheName: 'offlineCache',
      expiration: {
        maxEntries: 200,
      },
    }
  }]
}
    })
  ]
})