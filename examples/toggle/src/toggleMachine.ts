import { createMachine } from 'xstate';

export const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        toggle: { target: 'active' }
      }
    },
    active: {
      on: {
        toggle: { target: 'inactive' }
      }
    }
  }
});
