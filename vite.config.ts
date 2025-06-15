/// <reference types="node" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Make process.env.API_KEY available in the client-side code, ensuring it's a string.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || "")
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_DEV_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        }
      }
    },
    build: {
      rollupOptions: {
        // @google/genai is loaded via import map in index.html from esm.sh.
        // Mark it as external to prevent Vite from trying to bundle it or its peer dependencies.
        external: ['@google/genai'] 
      }
    }
  }
})