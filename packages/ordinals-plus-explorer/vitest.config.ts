import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    nodePolyfills(),
  ],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/**/*.{test,spec}.{ts,tsx}'],
    // Mock CSS modules
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    deps: {
      inline: ['happy-dom'],
    }
  },
}); 