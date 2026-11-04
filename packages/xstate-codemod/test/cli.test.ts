import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main } from '../src/cli.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'xstate-codemod-cli-'));
  writeFileSync(
    join(dir, 'v5.ts'),
    `import { assign } from 'xstate';\nconst a = assign({ count: 0 });\n`
  );
  writeFileSync(join(dir, 'clean.ts'), `export const value = 1;\n`);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function runCli(argv: string[]): { code: number; stdout: string } {
  const original = process.stdout.write;
  let stdout = '';
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  try {
    return { code: main(argv), stdout };
  } finally {
    process.stdout.write = original;
  }
}

describe('cli', () => {
  it('exits 2 for sites from every report transform', () => {
    writeFileSync(
      join(dir, 'done.ts'),
      `import { createMachine } from 'xstate';
export const m = createMachine({
  initial: 'a',
  states: {
    a: { on: { 'xstate.after.1000.a': { target: 'b' } } },
    b: {}
  }
});
`
    );
    const { code, stdout } = runCli([
      'migrate',
      join(dir, 'done.ts'),
      '--dry',
      '--json'
    ]);
    expect(code).toBe(2);
    expect(JSON.parse(stdout).manualSites).toEqual([
      expect.objectContaining({
        transform: 'suffixed-lifecycle-events',
        api: 'xstate.after.1000.a',
        line: 5
      })
    ]);
  });

  it('exits 2 for sites from a rewriting transform', () => {
    writeFileSync(
      join(dir, 'types-ref.ts'),
      `import { createMachine } from 'xstate';
const machineTypes = {};
export const m = createMachine({
  types: machineTypes
});
`
    );
    const { code, stdout } = runCli([
      'migrate',
      join(dir, 'types-ref.ts'),
      '--dry',
      '--json'
    ]);
    expect(code).toBe(2);
    expect(JSON.parse(stdout).manualSites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transform: 'types-to-schemas',
          api: 'types',
          line: 4
        })
      ])
    );
  });

  it('prints one JSON document and exits 2 when manual migration is needed', () => {
    const { code, stdout } = runCli([
      'migrate',
      join(dir, 'v5.ts'),
      '--dry',
      '--json'
    ]);
    expect(code).toBe(2);
    const report = JSON.parse(stdout);
    expect(Object.keys(report).sort()).toEqual([
      'files',
      'filesChanged',
      'manualSites'
    ]);
    expect(report.files).toHaveLength(1);
    expect(report.files[0]).toMatchObject({
      filePath: expect.stringMatching(/v5\.ts$/),
      changed: expect.any(Boolean)
    });
    expect(report.files[0].transforms[0]).toEqual({
      name: expect.any(String),
      changed: expect.any(Boolean),
      notes: expect.any(Array)
    });
    expect(report.manualSites).toEqual([
      {
        file: expect.stringMatching(/v5\.ts$/),
        line: 2,
        column: expect.any(Number),
        api: 'assign',
        hint: expect.any(String),
        transform: 'report-removed-apis'
      }
    ]);
  });

  it('exits 2 in text mode when manual migration is needed', () => {
    const { code, stdout } = runCli(['migrate', join(dir, 'v5.ts'), '--dry']);
    expect(code).toBe(2);
    expect(stdout).toContain('Manual migration needed');
  });

  it('exits 0 for a clean file', () => {
    const { code, stdout } = runCli([
      'migrate',
      join(dir, 'clean.ts'),
      '--dry',
      '--json'
    ]);
    expect(code).toBe(0);
    expect(JSON.parse(stdout).manualSites).toEqual([]);
  });
});
