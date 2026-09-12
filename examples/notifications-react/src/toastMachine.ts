import { setup, types } from 'xstate';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastSpec {
  id: string;
  kind: ToastKind;
  message: string;
}

/** One toast actor: it owns its own auto-dismiss timer. */
export const toastMachine = setup({
  schemas: {
    context: types<ToastSpec>(),
    input: types<ToastSpec>(),
    output: types<{ id: string }>(),
    events: {
      pause: types<{}>(),
      resume: types<{}>(),
      dismiss: types<{}>()
    }
  },
  delays: {
    autoDismiss: 4000
  }
}).createMachine({
  context: ({ input }) => input,
  initial: 'showing',
  states: {
    showing: {
      // Entering `showing` starts the timer, so resuming after a hover
      // restarts the full delay.
      after: {
        autoDismiss: { target: 'dismissed' }
      },
      on: {
        pause: { target: 'paused' }
      }
    },
    paused: {
      on: {
        resume: { target: 'showing' }
      }
    },
    dismissed: {
      type: 'final',
      output: ({ context }) => ({ id: context.id })
    }
  },
  on: {
    dismiss: { target: '.dismissed' }
  }
});
