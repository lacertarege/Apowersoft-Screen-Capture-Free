import { defineConfig } from 'vite'

// Vite config to ensure SPA mode and serve index.html at /
export default defineConfig({
  root: '.',
  appType: 'spa',
  server: {
    port: 5173,
    strictPort: true,
    host: true
  },
  preview: {
    host: true,
    port: 3000
  },
  build: {
    // Optimizaciones para producción
    target: 'es2015',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
})