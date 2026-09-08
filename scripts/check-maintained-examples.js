const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const projects = ['fetch', 'persisted-donut-maker', 'snake-react'];
execFileSync(
  process.execPath,
  [path.join(__dirname, 'typecheck-examples.js'), ...projects],
  { cwd: root, stdio: 'inherit' }
);
for (const project of projects) {
  execFileSync(
    'pnpm',
    ['--dir', path.join(root, 'examples', project), 'build'],
    { cwd: root, stdio: 'inherit' }
  );
}
execFileSync('pnpm', ['test:tooling'], { cwd: root, stdio: 'inherit' });

execFileSync(
  'pnpm',
  ['exec', 'vitest', 'run', '--config', 'scripts/vitest-examples.config.mts'],
  { cwd: root, stdio: 'inherit' }
);

execFileSync(process.execPath, ['--test', 'scripts/donut-smoke.test.cjs'], {
  cwd: root,
  stdio: 'inherit'
});
