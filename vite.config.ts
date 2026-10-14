/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import laravel from 'laravel-vite-plugin'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [laravel({ input: 'resources/js/main.tsx', refresh: true }), react()],
  server: {
    // Allow tunnel/Codespaces host names in development.
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./resources/js/test-setup.ts'],
    globals: false,
  },
})
