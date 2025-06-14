/// <reference types="node" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as NodeJS.Process).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Make environment variables available in the client-side code
      // This makes `import.meta.env.VITE_GEMINI_API_KEY` available
      // For process.env style access (like process.env.API_KEY if needed for other libs),
      // you can define it like this:
      // 'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // 'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY) 
      // However, import.meta.env is the standard Vite way.
      // If you are only using import.meta.env, this define block for process.env might not be strictly necessary
      // unless other parts of your code or libraries expect process.env.
      'process.env': {} // Provide a basic process.env object
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