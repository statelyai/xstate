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

import { Machine } from 'xstate';

export const always = Machine({
  initial: 'checking',
  states: {
    checking: {
      always: {
        target: 'next'
      }
    },
    next: {}
  }
});
