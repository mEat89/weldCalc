import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/weldCalc/',
  test: {
    globals: true,
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jspdf') || id.includes('jspdf-autotable')) {
              return 'pdf-vendor';
            }
            if (id.includes('docx')) {
              return 'docx-vendor';
            }
            if (id.includes('react')) {
              return 'react-vendor';
            }
          }
        }
      }
    }
  }
})
