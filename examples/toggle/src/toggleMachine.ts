import { setup, types } from 'xstate';

export const toggleMachine = setup({
  schemas: {
    events: {
      toggle: types<{}>()
    }
  }
}).createMachine({
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
