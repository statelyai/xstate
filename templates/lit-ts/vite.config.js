import {defineConfig} from 'vite';
import {globSync} from 'tinyglobby';
import copy from 'rollup-plugin-copy';

const OUT_DIR = 'dist';
const ENTRIES_DIR = 'demo';
const ENTRIES_GLOB = [`${ENTRIES_DIR}/**/*.js`];

const copyConfig = {
  targets: [
    {
      src: [`${ENTRIES_DIR}/**/*.*`, `!${ENTRIES_GLOB}`],
      dest: OUT_DIR,
    },
  ],
  hook: 'writeBundle',
};

// https://github.com/vitejs/vite/discussions/1736#discussioncomment-5126923
const entries = Object.fromEntries(
  globSync(ENTRIES_GLOB).map((file) => {
    const [key] = file.match(new RegExp(`(?<=${ENTRIES_DIR}/).*`)) || [];
    return [key?.replace(/\.[^.]*$/, ''), file];
  })
);

export default defineConfig({
  plugins: [
    copy(copyConfig),
  ],

  build: {
    outDir: OUT_DIR,
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      input: entries,
      output: {
        dir: OUT_DIR,
        entryFileNames: '[name].js',
        format: 'es',
      },
    },
  },
});
