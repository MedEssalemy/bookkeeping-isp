import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: true, // listen on 0.0.0.0 so the dev server is reachable from outside the Docker container
    proxy: {
      '/api': {
        // Defaults to localhost:8000 for plain `npm run dev` on your machine.
        // docker-compose overrides this to http://backend:8000, since inside
        // a container "localhost" means the frontend container itself, not
        // the backend one — containers reach each other by service name.
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
      // The sidebar reads the deployed version from the API's /health.
      '/health': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
