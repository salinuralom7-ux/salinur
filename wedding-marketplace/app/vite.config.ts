import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the built site works on any static host subpath.
export default defineConfig({
  base: './',
  plugins: [react()],
})
