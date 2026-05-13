import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Frontend: localhost:5173 → Backend API proxy: localhost:8080
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // SSE / uzun süreli streaming (AI site builder) için: timeout'u kaldır,
        // buffer'lamayı devre dışı bırak — varsayılan 2dk Gemini uzun üretimlerde 502 verir.
        timeout: 0,
        proxyTimeout: 0,
        buffer: false,
        ws: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // SSE stream'i için Connection: keep-alive ve buffer kapalı
            if (req.url && req.url.includes('/ai/build-site/execute')) {
              proxyReq.setHeader('Connection', 'keep-alive');
              proxyReq.setHeader('Accept', 'text/event-stream');
            }
          });
        },
      },
    },
  },
})