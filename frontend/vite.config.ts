import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/whiteboards': 'http://localhost:4000',
      '/notifications': 'http://localhost:4000',
      '/collaborators': 'http://localhost:4000',
      '/invitations': 'http://localhost:4000'
      // Removed classify-image proxy
    }
  }
})

