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
    expect(notes).toHaveLength(5);
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
});
