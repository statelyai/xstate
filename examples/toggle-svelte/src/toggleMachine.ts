import { setup, types } from 'xstate';

/** How long the toggle stays on before it turns itself off. */
const AUTO_OFF_DELAY = 3_000;

export const toggleMachine = setup({
  schemas: {
    context: types<{ onCount: number }>(),
    events: {
      toggle: types<{}>(),
      keepOn: types<{}>()
    }
  },
  delays: { autoOff: AUTO_OFF_DELAY }
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
      // The delayed transition is armed when `on` is entered and cancelled when
      // it is exited.
      after: { autoOff: { target: 'off' } },
      on: {
        toggle: { target: 'off' },
        // `reenter: true` exits and re-enters `on`, which restarts the
        // `autoOff` timer. Without it the self-transition would be a no-op.
        keepOn: { target: 'on', reenter: true }
      }
    }
  }
});
