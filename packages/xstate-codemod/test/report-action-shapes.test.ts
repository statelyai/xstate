import { describe, expect, it } from 'vitest';
import { reportActionShapes } from '../src/transforms/report-action-shapes.ts';
import { applyTransform } from './helpers.ts';

describe('report-action-shapes', () => {
  it('reports non-function entry/exit and transition actions, never mutates', () => {
    const input = `import { assign, setup } from 'xstate';
const machine = setup({}).createMachine({
  initial: 'idle',
  entry: 'free',
  states: {
    idle: {
      exit: ['log', assign({ count: 1 })],
      on: { GO: { target: 'busy', actions: 'track' } }
    },
    busy: {
      after: { 1000: [{ target: 'idle', actions: ['a'] }] },
      invoke: {
        src: 'work',
        onDone: { target: 'idle', actions: () => {} }
      }
    }
  }
});`;
    const { output, changed, notes, sites } = applyTransform(
      reportActionShapes,
      input,
      'src/machine.ts'
    );

    expect(changed).toBe(false);
    expect(output).toBe(input);
    expect(sites).toEqual([
      {
        file: expect.stringMatching(/machine\.ts$/),
        line: 4,
        column: 3,
        api: 'entry',
        hint: expect.stringContaining('single function')
      },
      {
        file: expect.stringMatching(/machine\.ts$/),
        line: 7,
        column: 7,
        api: 'exit',
        hint: expect.stringContaining('single function')
      },
      {
        file: expect.stringMatching(/machine\.ts$/),
        line: 8,
        column: 35,
        api: 'actions',
        hint: expect.stringContaining('transition `actions` was removed')
      },
      {
        file: expect.stringMatching(/machine\.ts$/),
        line: 11,
        column: 22,
        api: 'transition-array',
        hint: expect.stringContaining('combine the candidates into an if-chain')
      },
      {
        file: expect.stringMatching(/machine\.ts$/),
        line: 11,
        column: 41,
        api: 'actions',
        hint: expect.stringContaining('transition `actions` was removed')
      },
      {
        file: expect.stringMatching(/machine\.ts$/),
        line: 14,
        column: 35,
        api: 'actions',
        hint: expect.stringContaining('transition `actions` was removed')
      }
    ]);
    expect(notes).toHaveLength(6);
    expect(notes[0]).toContain(":4:3 — 'entry'");
  });

  it('does not report function entry/exit or implementation action maps', () => {
    const input = `import { createMachine, setup } from 'xstate';
const a = setup({
  actions: { track: () => {}, nested: { actions: 'x' } }
}).createMachine({
  entry: (args, enq) => {},
  exit: function (args, enq) {},
  on: { GO: (args, enq) => ({ target: 'b' }) }
});
const b = createMachine(
  { entry: () => {} },
  { actions: { track: () => {} } }
);`;
    const { notes, sites } = applyTransform(reportActionShapes, input);
    expect(notes).toEqual([]);
    expect(sites).toEqual([]);
  });

  it('reports transition guard and cond keys, including every array element', () => {
    const input = `import { setup } from 'xstate';
const machine = setup({}).createMachine({
  initial: 'idle',
  states: {
    idle: {
      always: [{ guard: 'isDone', target: 'done' }, { target: 'busy' }],
      on: {
        GO: [
          { guard: ({ context }) => context.ok, target: 'busy' },
          { cond: { type: 'check' }, target: 'done' }
        ]
      }
    },
    busy: { after: { 100: { cond: 'late', target: 'done' } } },
    done: {}
  }
});`;
    const { output, sites } = applyTransform(reportActionShapes, input);
    expect(output).toBe(input);
    expect(
      sites.map(({ api, line, column }) => ({ api, line, column }))
    ).toEqual([
      { api: 'transition-array', line: 6, column: 15 },
      { api: 'guard', line: 6, column: 18 },
      { api: 'transition-array', line: 8, column: 13 },
      { api: 'guard', line: 9, column: 13 },
      { api: 'cond', line: 10, column: 13 },
      { api: 'cond', line: 14, column: 29 }
    ]);
    expect(sites[1].hint).toContain('transition `guard` was removed');
  });

  it('does not report guard keys outside transition objects', () => {
    const input = `import { setup } from 'xstate';
const machine = setup({
  guards: { guard: () => true, cond: () => true }
}).createMachine({
  meta: { guard: 'x' },
  on: { GO: { target: '.a' } },
  states: { a: { meta: { cond: 'y' } } }
});`;
    const { sites } = applyTransform(reportActionShapes, input);
    expect(sites).toEqual([]);
  });

  it('reports config values it cannot see into', () => {
    const input = `import { createMachine } from 'xstate';
import { shared, idle } from './shared';
const m = createMachine({
  on: shared,
  states: { idle }
});`;
    const { sites } = applyTransform(reportActionShapes, input, 'src/a.ts');
    expect(sites?.map((s) => s.api)).toEqual([
      'indirect-config',
      'indirect-config'
    ]);
  });
});
