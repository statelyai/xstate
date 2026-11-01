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

describe('classify', () => {
  it('matches the intentional delta table', () => {
    expect(
      classify(
        'children',
        [{ id: 'w:0', src: 'w' }],
        [{ id: 'w:1', src: 'w' }],
        1
      )
    ).toMatchObject({
      rule: 'anonymous-child-id'
    });
    expect(
      classify('context', { a: 1, ref: { $actor: 'c' } }, { a: 1 }, 1)
    ).toMatchObject({
      rule: 'context-reference'
    });
    expect(
      classify(
        'processed',
        [{ type: 'xstate.done.actor', sessionId: 'a' }],
        [{ type: 'xstate.done.actor' }],
        1
      )
    ).toMatchObject({ rule: 'done-event-session' });
    expect(classify('context', { a: 1 }, { a: 2 }, 1)).toBe('unclassified');
    expect(classify('error', 'Error: a', 'Error: b', 1)).toBe('unclassified');
  });
});
