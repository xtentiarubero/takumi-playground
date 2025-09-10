import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Raise the warning threshold so a single heavy vendor chunk (e.g. monaco) doesn't always warn
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('monaco-editor') || id.includes('@monaco-editor')) return 'monaco';
            if (id.includes('@takumi-rs')) return 'takumi';
            if (id.includes('sucrase')) return 'sucrase';
            if (id.includes('react')) return 'react-vendor';
          }
        },
      },
    },
  },
})
