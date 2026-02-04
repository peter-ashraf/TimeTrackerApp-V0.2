import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/TimeTrackerApp-V0.2/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/favicon.png',
        'css/styles.css',
        'js/config.js',
        'js/utils.js',
        'js/main.js',
        'js/app/app.core.js',
        'js/app/app.system.js',
        'js/app/app.periods.js',
        'js/app/app.logic.js',
        'js/app/app.csv.js',
        'js/app/app.ui.js'
      ],
      manifest: {
        name: 'TimeTracker',
        short_name: 'TimeTracker',
        description: 'Professional Time & Leave Management Application',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#208589',
        icons: [
          {
            src: 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 192 192\'><rect fill=\'%23208589\' width=\'192\' height=\'192\'/><text x=\'50%\' y=\'50%\' font-size=\'100\' fill=\'%23fff\' text-anchor=\'middle\' dominant-baseline=\'middle\' font-family=\'Arial\'>⏱️</text></svg>',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      }
    })
  ]
});
