// Available variables:
// - Machine
// - interpret
// - assign
// - send
// - sendParent
// - spawn
// - raise
// - actions
// - XState (all XState exports)

import { assign, Machine } from 'xstate';

export const fetchMachine = Machine({
  id: 'fetch',
  initial: 'idle',
  context: {
    retries: 0
  },
  states: {
    idle: {
      on: {
        FETCH: {
          target: 'loading'
        }
      }
    },
    loading: {
      on: {
        RESOLVE: { target: 'success' },
        REJECT: { target: 'failure' }
      }
    },
    success: {
      type: 'final'
    },
    failure: {
      on: {
        RETRY: {
          target: 'loading'
        }
      }
    }
  }
});
