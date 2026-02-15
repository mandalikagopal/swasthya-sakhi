import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Polyfill 'global', 'process', 'buffer', etc.
      globals: {
        global: true,
        process: true,
        Buffer: true,
      },
      // Optional: polyfill crypto if needed
      protocolImports: true,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Swasthya Sakhi',
        short_name: 'Sakhi',
        description: 'Affordable Healthcare for Everyone',
        theme_color: '#4CAF50',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' }
        ]
      }
    }),
  ],
  server: {
    allowedHosts: [
      'localhost',
      '.ngrok-free.dev',  // ← This allows ALL ngrok-free subdomains (recommended)
      'boiled-mauro-unmercenarily.ngrok-free.dev'
    ],
    host: true,           // Optional: allows access from network
    port: 5173,
    https: false          // Keep false unless you set up self-signed cert
  }
})
