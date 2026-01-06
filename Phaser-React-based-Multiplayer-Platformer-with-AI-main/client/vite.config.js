import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  // Ensure assets are served correctly
  build: {
    assetsDir: 'assets',
  },
  // Make sure public directory is configured correctly
  publicDir: 'public',
})