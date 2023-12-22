import { assign, createMachine } from 'xstate';

export const counterMachine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QGMD2BXAdgFzAJwGIBLTZPMAWzBwG0AGAXUVAAdVYjsjVNmQAPRAEYALAE4AdAHYhAJnFipI2XVkBmAGwBWADQgAnojoBfY3rRZchCGDKVq2ekyQg2HLjz6CEoyTPliisqqmroGwkJ0ElqBgRqKWnQaImpCpmYgmKg28C4WOPh8bpzcvC7edHqGCCbpQA */
  id: 'counter',
  context: {
    count: 0
  },
  on: {
    increment: {
      actions: assign({
        count: ({ context }) => context.count + 1
      })
    },
    decrement: {
      actions: assign({
        count: ({ context }) => context.count - 1
      })
    }
  }
});
