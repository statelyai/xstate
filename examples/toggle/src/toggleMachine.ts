import { createMachine } from 'xstate';

export const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        toggle: 'active'
      }
    },
    active: {
      on: {
        toggle: 'inactive'
      }
    }
  }
});
