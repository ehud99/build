import process from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));

// Backend local en 8020. Las pruebas e2e levantan el suyo y lo pasan con `VITE_API_TARGET`.
const BACKEND = process.env.VITE_API_TARGET || 'http://127.0.0.1:8020';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.VITE_PORT || 5200),
    host: '127.0.0.1',
    proxy: {
      '/api': { target: BACKEND, changeOrigin: false, xfwd: true },
    },
  },
  resolve: {
    alias: { '@': resolve(here, './src') },
  },
});
