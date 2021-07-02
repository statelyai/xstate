import { createMachine } from 'xstate';

interface ToggleContext {
  count: number;
}

type ToggleEvent = {
  type: 'TOGGLE';
};

// Edit your machine(s) here
export const machine = createMachine<ToggleContext, ToggleEvent>({
  id: 'machine',
  initial: 'inactive',
  context: {
    count: 0
  },
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      on: { TOGGLE: 'inactive' }
    }
  }
});
