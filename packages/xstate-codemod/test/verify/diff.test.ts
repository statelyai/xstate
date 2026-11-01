import { describe, expect, it } from 'vitest';
import { classify, diffTraces } from '../../src/verify/diff.ts';
import type { Sequence, Trace, TraceStep } from '../../src/verify/types.ts';

const step = (overrides: Partial<TraceStep> = {}): TraceStep => ({
  input: { start: true },
  value: 'a',
  context: { count: 0 },
  status: 'active',
  processed: [],
  children: [],
  sent: [],
  emitted: [],
  actions: [],
  ...overrides
});

const sequence: Sequence = {
  id: 'random-0',
  origin: 'random',
  steps: [{ event: { type: 'INC' } }, { advance: 100 }]
};
const trace = (steps: TraceStep[]): Trace => ({
  sequenceId: 'random-0',
  steps
});

describe('diffTraces', () => {
  it('reports the first unclassified field with its witness and stops', () => {
    const expected = trace([
      step(),
      step({ context: { count: 1 } }),
      step({ value: 'b' })
    ]);
    const actual = trace([
      step(),
      step({ context: { count: 2 } }),
      step({ value: 'c' })
    ]);
    const { diffs, stepsCompared } = diffTraces(
      [sequence],
      [expected],
      [actual]
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({
      sequenceId: 'random-0',
      step: 1,
      field: 'context',
      witness: [{ event: { type: 'INC' } }],
      classification: 'unclassified'
    });
    expect(stepsCompared).toBe(2);
  });

  it('compares status before value and skips actions by default', () => {
    const expected = trace([step({ actions: [{ type: 'a', params: null }] })]);
    const actual = trace([step({ status: 'done', value: 'z' })]);
    expect(diffTraces([sequence], [expected], [actual]).diffs[0].field).toBe(
      'status'
    );
    expect(diffTraces([sequence], [expected], [trace([step()])]).diffs).toEqual(
      []
    );
    expect(
      diffTraces([sequence], [expected], [trace([step()])], ['actions'])
        .diffs[0].field
    ).toBe('actions');
  });

  it('records classified diffs and keeps comparing', () => {
    const expected = trace([
      step({ error: 'Error: boom' }),
      step({ value: 'b' })
    ]);
    const actual = trace([
      step({ error: 'TypeError: boom' }),
      step({ value: 'c' })
    ]);
    const { diffs } = diffTraces([sequence], [expected], [actual]);
    expect(diffs.map((d) => d.field)).toEqual(['value', 'error']);
    expect(diffs[1].classification).toMatchObject({
      rule: 'error-string-shape'
    });
  });
});

describe('diffTraces errored steps', () => {
  it('compares only status and error when both sides errored', () => {
    const expected = trace([
      step({ status: 'error', value: 'a', error: 'Error: boom' })
    ]);
    const actual = trace([
      step({
        status: 'error',
        value: undefined,
        context: {},
        error: 'Error: boom'
      })
    ]);
    expect(diffTraces([sequence], [expected], [actual]).diffs).toEqual([]);
    const other = trace([step({ status: 'error', error: 'Error: other' })]);
    expect(
      diffTraces([sequence], [expected], [other]).diffs.map((d) => d.field)
    ).toEqual(['error']);
  });

  it('adds the error message as detail to a status diff', () => {
    const expected = trace([step()]);
    const actual = trace([step({ status: 'error', error: 'Error: boom' })]);
    const [diff] = diffTraces([sequence], [expected], [actual]).diffs;
    expect(diff.field).toBe('status');
    expect(diff.detail).toBe('v6 error: Error: boom');
    const [reverse] = diffTraces([sequence], [actual], [expected]).diffs;
    expect(reverse.detail).toBe('v5 error: Error: boom');
    const done = trace([step({ status: 'done' })]);
    expect(
      diffTraces([sequence], [expected], [done]).diffs[0].detail
    ).toBeUndefined();
  });
});

describe('classify', () => {
  const steps = { expected: step(), actual: step() };
  it('matches the intentional delta table', () => {
    expect(
      classify(
        'children',
        [{ id: 'w:0', src: 'w' }],
        [{ id: 'w:1', src: 'w' }],
        1,
        steps
      )
    ).toMatchObject({
      rule: 'anonymous-child-id'
    });
    expect(
      classify('context', { a: 1, ref: { $actor: 'c' } }, { a: 1 }, 1, steps)
    ).toMatchObject({
      rule: 'context-reference'
    });
    expect(
      classify(
        'processed',
        [{ type: 'xstate.done.actor', sessionId: 'a' }],
        [{ type: 'xstate.done.actor' }],
        1,
        steps
      )
    ).toMatchObject({ rule: 'done-event-session' });
    expect(classify('context', { a: 1 }, { a: 2 }, 1, steps)).toBe(
      'unclassified'
    );
    expect(classify('error', 'Error: a', 'Error: b', 1, steps)).toBe(
      'unclassified'
    );
  });

  it('classifies a v5 root sendParent error as root-send-parent', () => {
    const errored = {
      expected: step({
        status: 'error',
        error:
          "Error: Unable to send event to actor '#_parent' from machine 'm'."
      }),
      actual: step()
    };
    expect(classify('status', 'error', 'active', 0, errored)).toMatchObject({
      rule: 'root-send-parent'
    });
    expect(
      classify('status', 'error', 'active', 0, {
        expected: step({ status: 'error', error: 'Error: boom' }),
        actual: step()
      })
    ).toBe('unclassified');
  });
});
