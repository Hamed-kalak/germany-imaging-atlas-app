import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Split heavy vendor libs into their own long-cached chunks so the
        // app code (which changes often) stays small and re-downloads cheaply.
        manualChunks: {
          react: ['react', 'react-dom'],
          d3: ['d3'],
          charts: ['recharts'],
        },
      },
    },
  },
})
