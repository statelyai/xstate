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
  if (pkg.name === '@xstate/effect') {
    for (const field of ['dependencies', 'optionalDependencies']) {
      if (Object.keys(pkg[field] ?? {}).length) {
        errors.push(`${pkg.name}: ${field} must stay empty`);
      }
    }
    for (const name of ['effect', 'xstate']) {
      if (
        !pkg.peerDependencies?.[name] ||
        pkg.peerDependenciesMeta?.[name]?.optional
      ) {
        errors.push(`${pkg.name}: ${name} must remain a required peer`);
      }
    }
    for (const name of Object.keys(pkg.peerDependencies ?? {})) {
      if (
        name !== 'effect' &&
        name !== 'xstate' &&
        pkg.peerDependenciesMeta?.[name]?.optional !== true
      ) {
        errors.push(`${pkg.name}: ${name} must be an optional peer`);
      }
    }
  }
  if (pkg.private || !pkg.files) continue;

  const exportKeys = new Set(Object.keys(pkg.exports ?? {}));
  const bins =
    typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin ?? {});
  const binDirs = new Set(bins.map((bin) => normalize(dirname(bin))));

  for (const entry of pkg.files) {
    const name = normalize(entry).replace(/\/$/, '');
    const fullPath = join(packagesDir, dir, name);
    const generated =
      name === 'dist' || (pkg.name === 'xstate' && name === 'docs');
    if (!/[*?[\]{}!]/.test(name) && !generated && !existsSync(fullPath)) {
      errors.push(
        `${pkg.name}: "files" includes "${name}" but it does not exist`
      );
      continue;
    }
    if (name === 'dist' || name === 'docs' || binDirs.has(name)) continue;
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
