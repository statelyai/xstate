import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');
const fixtureDir = path.join(
  repoRoot,
  'packages/xstate-react/test/lint-fixtures'
);
const fixtureConfig = path.join(fixtureDir, 'oxlintrc.fixtures.json');
const pluginPath = 'scripts/oxlint-plugin-xstate-react.ts';

interface OxlintDiagnostic {
  message: string;
  code: string;
}

/**
 * Lints one fixture with a config that enables only
 * `xstate/no-machine-in-component`, so the result is unaffected by the rest of
 * the repository's lint configuration.
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

describe('xstate/no-machine-in-component', () => {
  it('supports strict type-aware linting of the plugin itself', () => {
    const result = spawnSync(
      'pnpm',
      [
        'exec',
        'oxlint',
        '--type-aware',
        ...[
          'no-unsafe-assignment',
          'no-unsafe-call',
          'no-unsafe-member-access',
          'no-unsafe-argument',
          'no-unsafe-return',
          'strict-boolean-expressions'
        ].flatMap((rule) => ['--deny', `typescript/${rule}`]),
        pluginPath
      ],
      { cwd: repoRoot, encoding: 'utf8' }
    );

    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(0);
  }, 60_000);

  it('reports machines and stores created in component and hook bodies', () => {
    const diagnostics = lint('machine-in-component.tsx');

    expect(diagnostics).toHaveLength(4);
    expect(
      diagnostics.every(
        (diagnostic) =>
          diagnostic.code === 'xstate(no-machine-in-component)' &&
          diagnostic.message ===
            'Create machines at module scope, or memoize with useMemo; useActorRef keeps the first machine it receives.'
      )
    ).toBe(true);
  }, 60_000);

  it('reports nothing at module scope or in useMemo/useState initializers', () => {
    expect(lint('machine-outside-component.tsx')).toEqual([]);
  }, 60_000);
});
