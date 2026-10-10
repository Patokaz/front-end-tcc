/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      // Mesma origem para a API: o cookie de renovação (SameSite=Strict) funciona e o CORS fica desnecessário.
      proxy: env.API_PROXY_ALVO
        ? { '/api': { target: env.API_PROXY_ALVO, changeOrigin: true } }
        : undefined,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/testes/configuracao.ts'],
      css: false,
    },
  }
})
