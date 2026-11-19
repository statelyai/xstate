import { defineProject, type Plugin } from 'vitest/config';
import { transform } from '@solidjs/compiler';

// @solidjs/vite-plugin 3 needs Vite 8; the workspace is on Vite 6.
function solidJsx(): Plugin {
  return {
    name: 'xstate-solid:jsx',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.[jt]sx(?:\?|$)/.test(id) || id.includes('/node_modules/')) {
        return;
      }
      const result = transform(code, {
        filename: id,
        generate: 'dom',
        moduleName: '@solidjs/web',
        dev: true,
        sourceMap: true
      });
      return { code: result.code, map: result.map ?? null };
    }
  };
}

export default defineProject({
  plugins: [solidJsx()],
  test: {
    globals: true,
    // happy-dom drops `textContent = 0`.
    environment: 'jsdom',
    server: {
      deps: {
        // fixes: You appear to have multiple instances of Solid
        inline: ['solid-js', '@solidjs/web', '@solidjs/testing-library']
      }
    }
  },
  resolve: {
    conditions: ['module', 'development', 'browser']
  }
});
