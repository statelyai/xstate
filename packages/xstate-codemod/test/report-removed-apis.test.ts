import { describe, expect, it } from 'vitest';
import { reportRemovedApis } from '../src/transforms/report-removed-apis.ts';
import { applyTransform } from './helpers.ts';

describe('report-removed-apis', () => {
  it('reports removed APIs with file:line and never mutates', () => {
    const input = `import { assign, fromPromise, and } from 'xstate';
const a = assign({ count: 0 });
const p = fromPromise(async () => {});
const g = and(['x', 'y']);`;
    const { output, changed, notes } = applyTransform(
      reportRemovedApis,
      input,
      'src/machine.ts'
    );

    expect(changed).toBe(false);
    // File untouched.
    expect(output).toBe(input);

    // Detects each usage (not the import specifier itself).
    const joined = notes.join('\n');
    expect(joined).toContain("'assign'");
    expect(joined).toContain("'fromPromise'");
    expect(joined).toContain("'and'");
    // file:line format present.
    expect(notes.some((n) => /machine\.ts:\d+:\d+/.test(n))).toBe(true);
    // Replacement hints present.
    expect(joined).toContain('createAsyncLogic');
  });

  it('respects aliases', () => {
    const input = `import { assign as set } from 'xstate';
const a = set({ x: 1 });`;
    const { notes } = applyTransform(reportRemovedApis, input, 'src/a.ts');
    // Reports canonical name 'assign' even though used as `set`.
    expect(notes.some((n) => n.includes("'assign'"))).toBe(true);
  });

  it('does not report APIs imported from other libraries', () => {
    const input = `import { assign } from 'lodash';
const a = assign({}, b);`;
    const { changed, notes } = applyTransform(
      reportRemovedApis,
      input,
      'src/b.ts'
    );
    expect(changed).toBe(false);
    expect(notes).toHaveLength(0);
  });
});
