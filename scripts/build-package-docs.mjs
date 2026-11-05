import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'docs');
const destination = join(root, 'packages/core/docs');
const { pages } = JSON.parse(
  readFileSync(join(sourceDir, 'meta.json'), 'utf8')
);
const { version } = JSON.parse(
  readFileSync(join(root, 'packages/core/package.json'), 'utf8')
);
const documents = new Map(
  pages.map((page) => [
    `${page}.md`,
    readFileSync(join(sourceDir, `${page}.md`), 'utf8')
      .replaceAll(
        '../../xstate-store/v4/quick-start.md',
        'https://stately.ai/docs/xstate-store'
      )
      .replace(
        /\]\((react|vue|svelte|solid)\/([^\s)]+)\.md([#?][^\s)]*)?\)/g,
        '](https://stately.ai/docs/xstate/v6/$1/$2$3)'
      )
  ])
);

const stability = JSON.parse(
  execFileSync(
    process.execPath,
    [join(root, 'scripts/check-export-stability.mjs'), '--json', '--list'],
    { cwd: root, encoding: 'utf8' }
  )
);
if (!stability.ok)
  throw new Error('Cannot publish documentation with unclassified exports.');
documents.set(
  'api-stability.json',
  JSON.stringify(
    { schemaVersion: 1, xstateVersion: version, entries: stability.entries },
    null,
    2
  ) + '\n'
);

documents.set(
  'index.md',
  `# XState ${version}\n\nThese docs match the installed xstate package. Start with the [quick start](quick-start.md) or the [agent guide](agents.md).\nFor differences from v5, read the [migration guide](xstate-v5-to-v6.md).\nThe [export stability manifest](api-stability.json) classifies the installed source's public, experimental and internal exports.\n\n${pages
    .map((page) => {
      const source = documents.get(`${page}.md`);
      const title = source.match(/^title: (.+)$/m)?.[1] ?? page;
      return `- [${title}](${page}.md)`;
    })
    .join('\n')}\n`
);

for (const [file, source] of documents) {
  for (const [, link] of source.matchAll(/\]\(([^\s)]+)\)/g)) {
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(link)) continue;
    const target = join(dirname(file), link.split(/[?#]/)[0]);
    if (!documents.has(target)) {
      throw new Error(`${file}: local documentation link is missing: ${link}`);
    }
  }
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
for (const [file, source] of documents) {
  writeFileSync(join(destination, file), source);
}
console.log(
  `Bundled ${pages.length} documentation pages for xstate ${version}.`
);
