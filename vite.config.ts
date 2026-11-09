/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import pkg from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  // dev proxy (same as proxy.conf.json in the angular app), target overridable in .env.local
  const target = loadEnv(mode, process.cwd(), '').PROXY_TARGET || 'https://backoffice.somehost.org';
  const proxy = Object.fromEntries(['/api', '/sparql', '/proxy'].map((path) => [path, { target, secure: false, changeOrigin: true }]));
  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 4200,
      proxy,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'static',
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      // these packages import their own css: let vite process them (node can't import .css)
      server: { deps: { inline: [/@uiw\//, /react-pdf/] } },
      restoreMocks: true,
      clearMocks: true,
    },
  };
});
