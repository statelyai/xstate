import { INTENTIONAL_DELTAS } from './deltas.ts';
import { isEqual } from './normalize.ts';
import type {
  Classification,
  Diff,
  Sequence,
  Trace,
  TraceStep
} from './types.ts';

export const FIELD_ORDER = [
  'status',
  'value',
  'context',
  'output',
  'error',
  'processed',
  'children',
  'sent',
  'emitted',
  'actions'
] as const satisfies ReadonlyArray<keyof TraceStep>;

export const DEFAULT_FIELDS: string[] = FIELD_ORDER.filter(
  (f) => f !== 'actions'
);

export function classify(
  field: string,
  expected: unknown,
  actual: unknown,
  step: number
): Classification {
  const rule = INTENTIONAL_DELTAS.find((delta) =>
    delta.matches(field, expected, actual, step)
  );
  return rule
    ? { rule: rule.rule, section: rule.section, note: rule.note }
    : 'unclassified';
}

/**
 * Compares traces step by step. An unclassified mismatch ends its sequence;
 * classified (intentional) mismatches are recorded and comparison continues so
 * they cannot mask a later real divergence.
 */
export function diffTraces(
  sequences: Sequence[],
  expected: Trace[],
  actual: Trace[],
  fields: string[] = DEFAULT_FIELDS
): { diffs: Diff[]; stepsCompared: number } {
  const diffs: Diff[] = [];
  let stepsCompared = 0;
  const compared = FIELD_ORDER.filter((field) => fields.includes(field));
  for (const sequence of sequences) {
    const exp = expected.find((t) => t.sequenceId === sequence.id);
    const act = actual.find((t) => t.sequenceId === sequence.id);
    if (!exp || !act) continue;
    const length = Math.min(exp.steps.length, act.steps.length);
    outer: for (let step = 0; step < length; step++) {
      stepsCompared++;
      for (const field of compared) {
        const e = exp.steps[step][field];
        const a = act.steps[step][field];
        if (isEqual(e, a)) continue;
        const classification = classify(field, e, a, step);
        diffs.push({
          sequenceId: sequence.id,
          origin: sequence.origin,
          step,
          witness: sequence.steps.slice(0, step),
          field,
          expected: e,
          actual: a,
          classification
        });
        if (classification === 'unclassified') break outer;
      }
    }
  }
  diffs.sort(
    (a, b) =>
      Number(a.classification !== 'unclassified') -
      Number(b.classification !== 'unclassified')
  );
  return { diffs, stepsCompared };
}
