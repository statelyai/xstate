// Fixture: a v5 machine carried into v6 unchanged. The ONLY mistake is the
// `types` key, which v6 replaced with `schemas`; before it was rejected it was
// accepted and silently ignored, so the declared contracts did nothing.
// The benchmark captures whether the error names the replacement.
import { createMachine } from 'xstate';

export const machine = createMachine({
  types: {} as {
    context: { count: number };
    events: { type: 'TOGGLE' };
  },
  context: { count: 0 },
  initial: 'inactive',
  states: {
    inactive: { on: { TOGGLE: 'active' } },
    active: { on: { TOGGLE: 'inactive' } }
  }
});
