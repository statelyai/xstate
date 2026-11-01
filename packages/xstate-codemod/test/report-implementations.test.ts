import { describe, expect, it } from 'vitest';
import { reportImplementations } from '../src/transforms/report-implementations.ts';
import { applyTransform } from './helpers.ts';

describe('report-implementations', () => {
  it('reports a second createMachine argument and v5 signatures inside it', () => {
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
    ).toEqual([
      { api: 'implementations', line: 4, column: 3 },
      { api: 'action-signature', line: 5, column: 16 },
      { api: 'guard-signature', line: 6, column: 15 }
    ]);
    expect(sites[0].hint).toContain('second argument is ignored');
    expect(sites[1].hint).toContain('receive only `params`');
    expect(notes).toHaveLength(3);
  });

  it('reports v5 signatures in setup actions and guards', () => {
    const input = `import { setup } from 'xstate';
const machine = setup({
  actions: {
    'log it': ({ context, event }) => console.log(context, event),
    withParams: function (_, params) {},
    method({ event }) {},
    plain: (params) => console.log(params),
    none: () => {},
    named: assign({ count: 1 })
  },
  guards: {
    isFinished: ({ context }) => context.timeLeft === 0,
    isBig: (params) => params.n > 10
  },
  actors: { work: ({ input }) => input }
}).createMachine({});`;
    const { sites } = applyTransform(reportImplementations, input);
    expect(sites.map(({ api, line }) => ({ api, line }))).toEqual([
      { api: 'action-signature', line: 4 },
      { api: 'action-signature', line: 5 },
      { api: 'action-signature', line: 6 },
      { api: 'guard-signature', line: 12 }
    ]);
  });

  it('does not report one-argument createMachine or v6 implementations', () => {
    const input = `import { createMachine, setup } from 'xstate';
const a = createMachine({ initial: 'idle', states: { idle: {} } });
const b = setup({
  actions: { log: (params) => console.log(params), tick: () => {} },
  guards: { isReady: (params) => params.ready }
}).createMachine({});`;
    const { notes, sites } = applyTransform(reportImplementations, input);
    expect(notes).toEqual([]);
    expect(sites).toEqual([]);
  });
});
