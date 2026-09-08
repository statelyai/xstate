const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const examples = path.join(root, 'examples');
const projects = fs
  .readdirSync(examples)
  .filter((name) => fs.existsSync(path.join(examples, name, 'tsconfig.json')));
if (!projects.length) throw new Error('No TypeScript examples found');
console.log(`Checking all ${projects.length} TypeScript examples`);
execFileSync(
  process.execPath,
  [path.join(__dirname, 'typecheck-examples.js'), ...projects],
  { cwd: root, stdio: 'inherit' }
);
for (const project of projects) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(examples, project, 'package.json'), 'utf8')
  );
  if (!manifest.scripts?.build) {
    console.log(`No build script: ${project} (typecheck completed)`);
    continue;
  }
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
