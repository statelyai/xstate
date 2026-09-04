import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
const fixtureDir = path.join(
  repoRoot,
  'packages/xstate-effect/test/lint-fixtures'
);
const fixtureConfig = path.join(fixtureDir, 'oxlintrc.fixtures.json');

interface OxlintDiagnostic {
  message: string;
  code: string;
  filename: string;
}

/**
 * Lints one fixture with a config that enables only this repository's
 * `xstate-effect/no-inline-effect` rule, so the result is unaffected by the
 * rest of the repository's lint configuration.
 */
const lint = (fixture: string): OxlintDiagnostic[] => {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'oxlint',
      '-c',
      path.relative(repoRoot, fixtureConfig),
      '--format',
      'json',
      path.relative(repoRoot, path.join(fixtureDir, fixture))
    ],
    { cwd: repoRoot, encoding: 'utf8' }
  );

  if (result.error) {
    throw result.error;
  }
  const stdout = result.stdout ?? '';
  const start = stdout.indexOf('{');
  if (start === -1) {
    throw new Error(`oxlint produced no report:\n${stdout}\n${result.stderr}`);
  }
  return (
    JSON.parse(stdout.slice(start)) as { diagnostics: OxlintDiagnostic[] }
  ).diagnostics;
};

/** The rule's own message table, keyed by messageId. */
const messages = async (): Promise<Record<string, string>> => {
  const specifier = pathToFileURL(
    path.join(repoRoot, 'scripts/oxlint-plugin-xstate-effect.mjs')
  ).href;
  const plugin = await import(specifier);
  return plugin.default.rules['no-inline-effect'].meta.messages;
};

describe('xstate-effect/no-inline-effect', () => {
  it('reports inline Effect actions and inline spawned Effect logic', async () => {
    const { inlineAction, inlineSpawn } = await messages();
    const diagnostics = lint('inline-effect.ts');

    expect(
      diagnostics.every(
        (diagnostic) => diagnostic.code === 'xstate-effect(no-inline-effect)'
      )
    ).toBe(true);
    expect(
      diagnostics.filter((diagnostic) => diagnostic.message === inlineAction)
    ).toHaveLength(2);
    expect(
      diagnostics.filter((diagnostic) => diagnostic.message === inlineSpawn)
    ).toHaveLength(2);
  }, 60_000);

  it('reports nothing for declared actions and declared spawned actors', () => {
    expect(lint('declared-effect.ts')).toEqual([]);
  }, 60_000);
});
