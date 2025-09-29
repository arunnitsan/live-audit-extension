import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath, URL } from 'node:url'
import legacy from '@vitejs/plugin-legacy'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    legacy({
      targets: ['Chrome >= 88'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      modernPolyfills: true,
      renderLegacyChunks: false
    })
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        // Background script
        background: resolve(__dirname, 'src/background.ts'),
        
        // Content scripts
        content: resolve(__dirname, 'src/content.ts'),
        
        // Sidebar
        sidebar: resolve(__dirname, 'src/sidebar.ts'),
                
        // Options page
        options: resolve(__dirname, 'src/options.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep specific naming for Chrome extension
          if (chunkInfo.name === 'background') return 'background.js'
          if (chunkInfo.name === 'content') return 'content.js'
          if (chunkInfo.name === 'sidebar') return 'sidebar.js'
          if (chunkInfo.name === 'options') return 'options.js'
          return '[name].js'
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            // Keep specific naming for Chrome extension CSS files
            if (assetInfo.name === 'sidebar' || assetInfo.name === 'sidebar-styles') return 'sidebar.css'
            if (assetInfo.name === 'content') return 'content.css'
            if (assetInfo.name === 'options') return 'options.css'
            return 'styles/[name]-[hash][extname]'
          }
          if (assetInfo.name?.endsWith('.html')) {
            return '[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
        // Use ES modules format for Chrome extensions
        format: 'es',
        // Disable import.meta usage
        generatedCode: {
          constBindings: true
        },
        // Manual chunks configuration for better control
        manualChunks: (id) => {
          // Keep sidebar and its dependencies together
          if (id.includes('sidebar') || id.includes('AccesstiveSidebarWidget')) {
            return 'sidebar'
          }
          // Keep audit modules together
          if (id.includes('audit/') || id.includes('nsaAudit')) {
            return 'audit'
          }
          // Keep other chunks separate
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        }
      },
      // External dependencies that shouldn't be bundled
      external: (id) => {
        // Don't externalize anything for Chrome extensions
        return false
      }
    },
    // Ensure we don't minify too aggressively for Chrome extensions
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
        drop_debugger: false
      },
      mangle: {
        // Don't mangle Chrome extension APIs
        reserved: ['chrome', 'browser']
      }
    },
    // Source maps for debugging
    sourcemap: true,
    // Target modern browsers but avoid import.meta
    target: 'es2020',
    // Ensure proper module format
    modulePreload: false,
    // Disable dynamic imports that cause import.meta issues
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@assets': resolve(__dirname, 'src/assets'),
      '@audit': resolve(__dirname, 'src/audit'),
      '@types': resolve(__dirname, 'src/types')
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Remove additionalData to avoid @import/@use conflicts
      }
    }
  },
  define: {
    // Define environment variables
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    // Replace import.meta with alternatives
    'import.meta.url': '""',
    'import.meta.env': '{}'
  },
  server: {
    port: 3000,
    open: false
  },
  // Custom plugin to handle import.meta
  esbuild: {
    // Replace import.meta with alternatives
    define: {
      'import.meta.url': '""',
      'import.meta.env': '{}'
    }
  }
})