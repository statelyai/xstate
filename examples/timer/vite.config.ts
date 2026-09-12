import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: { dedupe: ['react', 'react-dom'] },
  plugins: [react()]
});
