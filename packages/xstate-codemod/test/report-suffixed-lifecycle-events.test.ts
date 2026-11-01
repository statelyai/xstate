import { describe, expect, it } from 'vitest';
import { reportSuffixedLifecycleEvents } from '../src/transforms/report-suffixed-lifecycle-events.ts';
import { applyTransform } from './helpers.ts';

describe('report-suffixed-lifecycle-events', () => {
  it('reports suffixed lifecycle keys at any depth and never mutates', () => {
    const input = `import { createMachine } from 'xstate';
const machine = createMachine({
  initial: 'checkout',
  states: {
    checkout: {
      initial: 'form',
      states: {
        form: {
          initial: 'editing',
          states: { editing: {}, valid: { type: 'final' } },
          on: { 'xstate.done.state.form': { target: 'review' } }
        },
        review: {}
      }
    }
  },
  on: { 'xstate.after.1000.timer': { target: '.checkout' } }
});`;
    const { output, changed, notes, sites } = applyTransform(
      reportSuffixedLifecycleEvents,
      input,
      'src/machine.ts'
    );

    expect(changed).toBe(false);
    expect(output).toBe(input);
    expect(sites).toEqual([
      {
        file: expect.stringMatching(/machine\.ts$/),
        line: 11,
        column: 17,
        api: 'xstate.done.state.form',
        hint: expect.stringContaining('`xstate.done.state` with `stateId`')
      },
      {
        file: expect.stringMatching(/machine\.ts$/),
        line: 17,
        column: 9,
        api: 'xstate.after.1000.timer',
        hint: expect.stringContaining('`xstate.after` with `delay`')
      }
    ]);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain(":11:17 — 'xstate.done.state.form'");
    expect(notes[1]).toContain(":17:9 — 'xstate.after.1000.timer'");
  });

  it('does not report onDone or plain lifecycle keys', () => {
    const input = `import { createMachine } from 'xstate';
const machine = createMachine({
  initial: 'form',
  states: {
    form: {
      initial: 'editing',
      states: { editing: {}, valid: { type: 'final' } },
      onDone: { target: 'review' },
      on: { 'xstate.done.state': { target: 'review' } }
    },
    review: {}
  }
});`;
    const { notes, sites } = applyTransform(
      reportSuffixedLifecycleEvents,
      input
    );
    expect(notes).toEqual([]);
    expect(sites).toEqual([]);
  });
});
