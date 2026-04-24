import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@xstate/store': path.resolve(
        __dirname,
        '../../packages/xstate-store/src/index.ts'
      ),
      '@xstate/store-react': path.resolve(
        __dirname,
        '../../packages/xstate-store-react/src/index.ts'
      )
    }
  },
  plugins: [react()]
});
