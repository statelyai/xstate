import { defineProject, type Plugin } from 'vitest/config';
import { transform } from '@solidjs/compiler';

// `@solidjs/vite-plugin` 3 needs Vite 8, and the workspace runs Vitest 3 on
// Vite 6, so the tests compile JSX with Solid 2's compiler directly. Only the
// test files contain JSX; `src` is plain TypeScript.
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
    // happy-dom drops `textContent = 0`, which Solid 2 writes for a numeric text hole.
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
