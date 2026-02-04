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
      // ... other options
      manifest: {
        name: 'TimeTracker App',
        short_name: 'TimeTracker',
        description: 'Employee timesheet tracker',
        theme_color: '#208589',
        background_color: '#ffffff',
        display: 'standalone',
        // FIX THESE TWO LINES:
        scope: '/TimeTrackerApp-V0.2/', 
        start_url: '/TimeTrackerApp-V0.2/',
        icons: [
          {
            src: 'icons/adaptive-icon.png', // Ensure this path is correct inside /public
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable' // Add this for better Android support
          },
          {
            src: 'icons/adaptive-icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})