import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Served from the domain root; client routing uses real paths, so the host
  // needs an SPA fallback (see vercel.json and public/_redirects).
  base: '/',
  plugins: [react()],
  server: {
    // `vite dev` has no serverless runtime — point the API at a running
    // `vercel dev` when working on the payment routes locally.
    proxy: process.env.VITE_API_PROXY
      ? { '/api': { target: process.env.VITE_API_PROXY, changeOrigin: true } }
      : undefined,
  },
})
