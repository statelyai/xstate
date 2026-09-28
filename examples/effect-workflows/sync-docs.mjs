import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const exampleRoot = fileURLToPath(new URL('.', import.meta.url));
const packageRoot = resolve(exampleRoot, '../../packages/xstate-effect');
const pages = [
  resolve(packageRoot, 'README.md'),
  ...readdirSync(resolve(packageRoot, 'docs'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => resolve(packageRoot, 'docs', name))
];

for (const page of pages) {
  const original = readFileSync(page, 'utf8');
  const updated = original.replace(
    /(<!-- example from examples\/effect-workflows\/src\/(.+?) -->\s+```tsx?\n)[\s\S]*?^(```)$/gm,
    (_, opening, name, closing) =>
      opening +
      readFileSync(resolve(exampleRoot, 'src', name), 'utf8').trim() +
      '\n' +
      closing
  );
  if (updated !== original) writeFileSync(page, updated);
}
