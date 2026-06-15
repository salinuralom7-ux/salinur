import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built site works on GitHub Pages or any static host subpath.
  base: './',
  plugins: [react()],
  server: {
    // In dev, proxy API calls to the Express backend.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
