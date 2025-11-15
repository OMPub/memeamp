import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    port: 6529,
    proxy: {
      '/api-6529': {
        target: 'https://api.6529.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path: string) => path.replace(/^\/api-6529/, ''),
      },
    },
  }
})
