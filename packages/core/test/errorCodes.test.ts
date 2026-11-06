import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { xstateError } from '../src/xstateError.ts';

const srcDir = join(__dirname, '../src');
const docsFile = join(__dirname, '../../../docs/errors.md');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith('.ts') && !name.includes('.test.') ? [path] : [];
  });
}

describe('error codes', () => {
  it('documents every code used in src, and only those codes', () => {
    const used = new Set<number>();
    for (const file of sourceFiles(srcDir)) {
      for (const [, code] of readFileSync(file, 'utf8').matchAll(
        /\bxstateError\(\s*(\d+)/g
      )) {
        used.add(Number(code));
      }
    }
    const headings = [
      ...readFileSync(docsFile, 'utf8').matchAll(/^## E(\d+)$/gm)
    ].map(([, code]) => Number(code));

    expect(new Set(headings).size).toBe(headings.length);
    expect([...used].sort((a, b) => a - b)).toEqual(
      [...headings].sort((a, b) => a - b)
    );
  });

  it('formats the code, the values and the docs link', () => {
    expect(xstateError(12, 'services', 3)).toBe(
      'XState error E12 ("services", 3). See https://github.com/statelyai/xstate/blob/next/docs/errors.md#e12'
    );
    expect(xstateError(71)).toBe(
      'XState error E71. See https://github.com/statelyai/xstate/blob/next/docs/errors.md#e71'
    );
  });

  it('throws coded messages in production builds', async () => {
    vi.resetModules();
    vi.doMock('#is-development', () => ({ default: false }));
    try {
      const { createMachine, createActor } = await import('../src/index.ts');
      const actor = createActor(createMachine({ id: 'm' }), { id: 'a' });
      actor.start();
      actor.stop();
      expect(() => actor.start()).toThrowError(
        'XState error E48 ("a"). See https://github.com/statelyai/xstate/blob/next/docs/errors.md#e48'
      );
      expect(() =>
        createMachine({
          initial: 'a',
          states: { a: { after: { soon: 'b' } }, b: {} }
        } as any)
      ).toThrowError('XState error E38 ("after.soon", "a", "b")');
    } finally {
      vi.doUnmock('#is-development');
      vi.resetModules();
    }
  });
});
