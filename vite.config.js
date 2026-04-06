import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PWA desactivada temporalmente para resolver problema de cache
// Se reactivará en v3.1 cuando el SW viejo expire naturalmente
export default defineConfig({
  plugins: [
    react(),
  ],
})
