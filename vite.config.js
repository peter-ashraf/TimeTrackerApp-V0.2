import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import pkg from './package.json' with { type: 'json' }

// Version updates on every build: major.minor from package.json, patch = git commit count.
const git = (cmd) => {
  try { return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return '' }
}
const [major = '0', minor = '1'] = pkg.version.split('.')
const commitCount = git('rev-list --count HEAD')
const shortSha = (process.env.GITHUB_SHA || git('rev-parse --short HEAD') || 'local').slice(0, 7)
const appVersion = commitCount ? `${major}.${minor}.${commitCount}` : pkg.version

// vite.config.js
export default defineConfig({
  base: '/TimeTrackerApp-V0.2/',
  publicDir: 'public',
  
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GIT_COMMIT__: JSON.stringify(shortSha),
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
    </script>
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
            src: 'icons/adaptive-icon-light.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/adaptive-icon-dark-mode.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2,ttf,eot}'],
        maximumFileSizeToCacheInBytes: 5242880
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
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom'],
          // Router
          'router': ['react-router-dom'],
          // Supabase (large)
          'supabase': ['@supabase/supabase-js'],
          // Export/PDF libraries are very large, better to put them in their own chunks
          'xlsx-vendor': ['xlsx'],
          'pdf-vendor': ['jspdf', '@react-pdf/renderer', 'html2canvas'],
          // Local utilities
          'utils': ['crypto-js', 'emailjs-com']
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    chunkSizeWarningLimit: 1000 // Increase threshold temporarily
  }
})
