import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packages = [
  'core',
  'xstate-react',
  'xstate-vue',
  'xstate-svelte',
  'xstate-solid',
  'xstate-test',
  'xstate-effect',
  'xstate-scxml',
  'xstate-codemod'
];

export function releaseTagMismatches(expected, observed) {
  return Object.entries(expected).flatMap(([name, version]) =>
    observed[name] === version
      ? []
      : [{ name, expected: version, observed: observed[name] ?? null }]
  );
}

async function main() {
  const tagIndex = process.argv.indexOf('--tag');
  const tag = process.argv[tagIndex + 1];
  if (tagIndex < 0 || !tag || !/^[a-z][a-z0-9.-]*$/i.test(tag)) {
    throw new Error(
      'Usage: node scripts/check-release-tags.mjs --tag <dist-tag>'
    );
  }
  const expected = Object.fromEntries(
    packages.map((directory) => {
      const { name, version } = JSON.parse(
        readFileSync(join(root, 'packages', directory, 'package.json'), 'utf8')
      );
      return [name, version];
    })
  );
  let mismatches;
  for (let attempt = 0; attempt < 5; attempt++) {
    const observed = {};
    for (const name of Object.keys(expected)) {
      try {
        const output = execFileSync(
          process.platform === 'win32' ? 'npm.cmd' : 'npm',
          ['view', `${name}@${tag}`, 'version', '--json'],
          {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 15000
          }
        );
        observed[name] = JSON.parse(output);
      } catch {
        observed[name] = null;
      }
    }
    mismatches = releaseTagMismatches(expected, observed);
    if (!mismatches.length) {
      console.log(JSON.stringify({ ok: true, tag, versions: observed }));
      return;
    }
    if (attempt < 4) await setTimeout(1000 * 2 ** attempt);
  }
  console.error(JSON.stringify({ ok: false, tag, mismatches }));
  process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
