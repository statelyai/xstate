const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const template of ['react-ts', 'vue-ts', 'svelte-ts', 'vanilla-ts']) {
  const directory = path.join(root, 'templates', template);
  execFileSync('pnpm', ['install', '--frozen-lockfile'], {
    cwd: directory,
    stdio: 'inherit'
  });
  execFileSync('pnpm', ['build'], { cwd: directory, stdio: 'inherit' });
}
