import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// vite.config.js
export default defineConfig({
  base: '/TimeTrackerApp-V0.2/',
  publicDir: 'public',
  
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GIT_COMMIT__: JSON.stringify(process.env.GITHUB_SHA || 'local'),
  },
  
  plugins: [
    react(),
    {
      name: 'copy-404',
      closeBundle() {
        this.emitFile({
          type: 'asset',
          fileName: '404.html',
          source: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>TimeTracker App</title>
    <script>
      // Single Page App for GitHub Pages
      // Redirect to the main index.html and let React Router handle the routing
      var segmentCount = 0;
      var l = window.location;
      l.replace(
        l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
        l.pathname.split('/').slice(0, 1 + segmentCount).join('/') + '/?p=/' +
        l.pathname.slice(1).split('/').slice(segmentCount).join('/').replace(/&/g, '~and~') +
        (l.search ? '&q=' + l.search.slice(1).replace(/&/g, '~and~') : '') +
        l.hash
      );
    <\/script>
  </head>
  <body>
  </body>
</html>`
        });
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
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
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2,ttf,eot}']
      }
    })
  ],
  server: {
    hmr: {
      overlay: false  // Disable HMR overlay to prevent React hook order issues
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Function-based resolver so we can pin specific local modules into
        // the main chunk, preventing circular dynamic-import chunk splitting
        // from breaking named exports (e.g. SYNC_STATUS_EVENT).
        manualChunks(id) {
          // Always keep timeEntrySyncStatus in the main bundle — backgroundSync
          // dynamically imports supabaseData/offlineQueue which causes Vite to
          // try to split this module into a deferred chunk where its exports
          // aren't initialized yet, crashing with "Export is not defined".
          if (id.includes('timeEntrySyncStatus')) return 'index';

          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/')) return 'react-vendor';
            if (id.includes('react-router-dom')) return 'router';
            if (id.includes('@supabase/supabase-js')) return 'supabase';
            if (id.includes('xlsx')) return 'xlsx-vendor';
            if (id.includes('jspdf') || id.includes('@react-pdf') || id.includes('html2canvas')) return 'pdf-vendor';
            if (id.includes('crypto-js') || id.includes('emailjs-com')) return 'utils';
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true
      }
    },
    chunkSizeWarningLimit: 1000 // Increase threshold temporarily
  }
})
