import { createMachine, assign } from 'xstate';

interface ToggleContext {
  count: number;
}

type ToggleEvent = {
  type: 'TOGGLE';
};

// Edit your machine(s) here
export const toggleMachine = createMachine<ToggleContext, ToggleEvent>({
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
      entry: assign({ count: (context) => context.count + 1 }),
      on: { TOGGLE: 'inactive' }
    }
  }
});
