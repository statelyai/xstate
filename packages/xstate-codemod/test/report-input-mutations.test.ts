import { describe, expect, it } from 'vitest';
import { reportInputMutations } from '../src/transforms/report-input-mutations.ts';
import { transformsByName } from '../src/transforms/index.ts';
import { applyTransform } from './helpers.ts';

const lines = (code: string, fileName = 'src/logic.ts') =>
  applyTransform(reportInputMutations, code, fileName).sites.map((s) => [
    s.api,
    s.line
  ]);

describe('report-input-mutations', () => {
  it('is registered', () => {
    expect(transformsByName['report-input-mutations']).toBe(
      reportInputMutations
    );
  });

  it('reports writes to input paths and never mutates', () => {
    const input = `import { fromPromise } from 'xstate';
export const logicNotesDecrypt = fromPromise(async ({ input }) => {
  const decryptedText = await decrypt(input.note.text);
  input.note.text = decryptedText;
  input.note.encryptionState = 'decrypted';
  return input.note;
});`;
    const { output, changed, notes, sites } = applyTransform(
      reportInputMutations,
      input,
      'src/notes.ts'
    );
    expect(changed).toBe(false);
    expect(output).toBe(input);
    expect(sites.map((s) => [s.api, s.line, s.column])).toEqual([
      ['input-assignment', 4, 3],
      ['input-assignment', 5, 3]
    ]);
    expect(sites[0].hint).toContain('Context is frozen in development');
    expect(sites[0].hint).toContain('docs/xstate-v5-to-v6.md');
    expect(notes[0]).toMatch(/notes\.ts:4:3 — 'input-assignment'/);
  });

  it('reports compound assignments, updates, delete and mutators', () => {
    const input = `import { createAsyncLogic } from 'xstate';
const logic = createAsyncLogic({
  run: async ({ input }) => {
    input.count += 1;
    input.stats.total ??= 0;
    input.stats.total++;
    --input.stats.total;
    delete input.x.y;
    input.list.push(1);
    input.list.splice(0, 1);
    input['list'].sort();
    Object.assign(input.x, { y: 1 });
    input.x[0] = 1;
  }
});`;
    expect(lines(input)).toEqual([
      ['input-assignment', 4],
      ['input-assignment', 5],
      ['input-assignment', 6],
      ['input-assignment', 7],
      ['input-delete', 8],
      ['input-push', 9],
      ['input-splice', 10],
      ['input-sort', 11],
      ['input-object-assign', 12],
      ['input-assignment', 13]
    ]);
  });

  it('follows args.input, renamed and nested destructuring, and const aliases', () => {
    const input = `import { fromCallback as cb, createCallbackLogic } from 'xstate';
const a = cb((args) => {
  args.input.items.push(1);
});
const b = createCallbackLogic(({ input: data }) => {
  data.value = 1;
});
const c = createCallbackLogic(({ input: { note } }) => {
  note.text = '';
});
const d = createCallbackLogic(({ input }) => {
  const note = input.note;
  const { tags } = note;
  tags.reverse();
  note.text = '';
});`;
    expect(lines(input)).toEqual([
      ['input-push', 3],
      ['input-assignment', 6],
      ['input-assignment', 9],
      ['input-reverse', 14],
      ['input-assignment', 15]
    ]);
  });

  it('follows in-file named logic functions', () => {
    const input = `import { createAsyncLogic } from 'xstate';
async function run({ input }) {
  input.done = true;
}
const logic = createAsyncLogic({ run });
const update = ({ input }) => {
  input.items.pop();
};
const other = createAsyncLogic({ run: update });
const method = createAsyncLogic({
  run({ input }) {
    input.x = 1;
  }
});`;
    expect(lines(input)).toEqual([
      ['input-assignment', 3],
      ['input-pop', 7],
      ['input-assignment', 12]
    ]);
  });

  it('does not report local variables, copies, or shadowed input', () => {
    const input = `import { fromPromise } from 'xstate';
const logic = fromPromise(async ({ input }) => {
  const result = { ...input.note };
  result.text = 'x';
  const list = input.list.slice();
  list.push(1);
  let note = input.note;
  note.text = 'y';
  const read = input.note.text;
  [1].forEach((input) => {
    input.x = 1;
  });
  input = { note: {} };
  return { ...input.note, text: read };
});`;
    expect(lines(input)).toEqual([]);
  });

  it('ignores input outside logic creators and creators from other modules', () => {
    const input = `import { fromPromise } from 'some-lib';
const a = fromPromise(async ({ input }) => {
  input.x = 1;
});
function plain({ input }) {
  input.x = 1;
}`;
    expect(lines(input)).toEqual([]);
  });
});
