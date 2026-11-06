import { describe, expect, it } from 'vitest';
import { reportImplementations } from '../src/transforms/report-implementations.ts';
import { applyTransform } from './helpers.ts';

describe('report-implementations', () => {
  it('reports a second createMachine argument', () => {
    const input = `import { createMachine } from 'xstate';
const machine = createMachine(
  { initial: 'idle', states: { idle: {} } },
  {
    actions: { track: ({ context }) => console.log(context), noop: () => {} },
    guards: { isReady: (_, params) => params.ready },
    actors: { work: ({ input }) => input },
    delays: { wait: ({ context }) => context.ms }
  }
);`;
    const { output, changed, notes, sites } = applyTransform(
      reportImplementations,
      input,
      'src/machine.ts'
    );
    expect(changed).toBe(false);
    expect(output).toBe(input);
    expect(
      sites.map(({ api, line, column }) => ({ api, line, column }))
    ).toEqual([{ api: 'implementations', line: 4, column: 3 }]);
    expect(sites[0].hint).toContain('second argument is ignored');
    expect(notes).toHaveLength(1);
  });

  it('does not report one-argument createMachine or setup implementations', () => {
    const input = `import { createMachine, setup } from 'xstate';
const a = createMachine({ initial: 'idle', states: { idle: {} } });
const b = setup({
  actions: { log: (params) => console.log(params), tick: () => {} },
  guards: { isReady: ({ context }) => context.ready }
}).createMachine({});`;
    const { notes, sites } = applyTransform(reportImplementations, input);
    expect(notes).toEqual([]);
    expect(sites).toEqual([]);
  });
});
