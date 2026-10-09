import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    // File events do not cross Docker bind mounts on Windows; poll inside the container.
    watch: { usePolling: process.env.VITE_USE_POLLING === 'true' },
  },
})
