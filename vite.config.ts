import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// STANDALONE builds one self-contained index.html (no backend, data baked in).
const standalone = process.env.STANDALONE === 'true'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built site works on GitHub Pages or any static host subpath.
  base: './',
  plugins: [react(), ...(standalone ? [viteSingleFile()] : [])],
  define: standalone
    ? { 'import.meta.env.VITE_STANDALONE': JSON.stringify('true') }
    : undefined,
  build: standalone
    ? {
        // Inline every asset (logo, etc.) as data URIs so the output is a single file.
        assetsInlineLimit: 100_000_000,
        outDir: 'dist-standalone',
      }
    : undefined,
  server: {
    // In dev, proxy API calls to the Express backend.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
