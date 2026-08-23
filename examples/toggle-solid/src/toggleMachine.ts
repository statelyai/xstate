import { setup, types } from 'xstate';

export const toggleMachine = setup({
  schemas: {
    context: types<{ onCount: number }>(),
    events: { toggle: types<{}>() }
  }
}).createMachine({
  id: 'toggle',
  context: { onCount: 0 },
  initial: 'off',
  states: {
    off: {
      on: {
        toggle: ({ context }) => ({
          target: 'on',
          context: { onCount: context.onCount + 1 }
        })
      }
    },
    on: {
      on: { toggle: { target: 'off' } }
    }
  }
});
