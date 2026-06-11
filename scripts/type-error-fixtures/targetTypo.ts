// Fixture: the ONLY mistake is a typo'd transition target
// (`activ` instead of `active`).
import { createMachine } from 'xstate';

export const machine = createMachine({
  initial: 'inactive',
  states: {
    inactive: { on: { TOGGLE: 'activ' } },
    active: { on: { TOGGLE: 'inactive' } }
  }
});
