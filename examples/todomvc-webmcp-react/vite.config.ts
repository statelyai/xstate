import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // @xstate/react resolves to workspace source; use one copy of React.
  resolve: { dedupe: ['react', 'react-dom'] }
});
