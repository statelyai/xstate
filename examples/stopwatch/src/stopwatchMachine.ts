import { assign, createMachine, fromCallback } from 'xstate';

export const stopwatchMachine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwC4HsAOB3AhigxgBYB0qmGkAxKjgE4oDaADALqKgZqwCWK3aAO3YgAHogCsAFgDsxcQEYATOKYA2SQGZF68QBoQAT0Qbp44pICcVi6o2T509RYC+z-WWx4ixWgFcBAtwCUJQAKgCSAMIA0sxsSCCcPHyCwmII8kzyZgAcOaZMOeLSijmK9vpGCBpKxLYaDfJKTApMLm4gHrgEJH4BQSEeccJJvPxCCelSOXJKKuoO0po5lYilZpbWqhYmOU2Sru7onj2UtHBgjKwjXGOpk4iqTKvVGjPaqp8aFpIyikoHQ4gARoCBwYRdLyEG7JcZpRBKF7yLRyaw2CwFdSKaRAyE9UjHCgQGF3CagdKSNTEbTKJjSaQWRQmcQ5VQvDSqWSOT6qbIY6R5Dm447dbx9QLBEkpMmiR6fYgCzGM1TlcQWF6KGzEHINBqFGRaTWA1xAA */
  id: 'stopwatch',
  initial: 'stopped',
  context: {
    elapsed: 0
  },
  states: {
    stopped: {
      on: {
        start: 'running'
      }
    },
    running: {
      invoke: {
        src: fromCallback((sendBack) => {
          const interval = setInterval(() => {
            sendBack({ type: 'TICK' });
          }, 10);
          return () => clearInterval(interval);
        })
      },
      on: {
        TICK: {
          actions: assign({
            elapsed: ({ context }) => context.elapsed + 1
          })
        },
        stop: 'stopped'
      }
    }
  },
  on: {
    reset: {
      actions: assign({
        elapsed: 0
      }),
      target: '.stopped'
    }
  }
});
