// Asserts that every literal path listed in a package's `files` exists, and
// that every directory listed in a package's `files` (other than
// `dist` and directories that only hold `bin` scripts) has a matching
// `exports` entry, so published subpath folders are always importable.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = join(root, 'packages');
const errors = [];

for (const dir of readdirSync(packagesDir)) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (pkg.private || !pkg.files) continue;

  const exportKeys = new Set(Object.keys(pkg.exports ?? {}));
  const bins =
    typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin ?? {});
  const binDirs = new Set(bins.map((bin) => normalize(dirname(bin))));

  for (const entry of pkg.files) {
    const name = normalize(entry).replace(/\/$/, '');
    const fullPath = join(packagesDir, dir, name);
    if (!/[*?[\]{}!]/.test(name) && name !== 'dist' && !existsSync(fullPath)) {
      errors.push(
        `${pkg.name}: "files" includes "${name}" but it does not exist`
      );
      continue;
    }
    if (name === 'dist' || binDirs.has(name)) continue;
    if (!existsSync(fullPath) || !statSync(fullPath).isDirectory()) continue;
    if (!exportKeys.has(`./${name}`)) {
      errors.push(
        `${pkg.name}: "files" includes "${name}/" but "exports" has no "./${name}" entry`
      );
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('package files check passed');
