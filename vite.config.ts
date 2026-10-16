import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Deterministic dev URL: fail loudly instead of silently moving to
    // another port when 5173 is already taken.
    port: Number.parseInt(process.env.VITE_PORT || '', 10) || 5173,
    strictPort: true,
  },
  preview: {
    port: Number.parseInt(process.env.VITE_PORT || '', 10) || 5173,
    strictPort: true,
  },
})