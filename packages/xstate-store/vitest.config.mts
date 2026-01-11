import { defineProject } from 'vitest/config';
import { include as includeSolid } from './vitest.config.solid.mts';
import { include as includeVue } from './vitest.config.vue.mts';

export default defineProject({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    exclude: [...includeSolid, ...includeVue],
    globals: true,
    environment: 'happy-dom'
  }
});
