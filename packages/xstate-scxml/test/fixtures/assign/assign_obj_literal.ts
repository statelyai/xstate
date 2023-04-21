import { createMachine, log, assign } from 'xstate';

export default createMachine({
  initial: 's1',
  context: {
    o1: null as { p1: string; p2: string } | null
  },
  states: {
    uber: {
      id: 'uber',
      on: {
        '*': {
          target: '#fail',
          actions: log(
            ({ event }) => `unhandled input ${JSON.stringify(event)}`,
            'TEST'
          )
        }
      }
    },
    s1: {
      id: 's1',
      on: {
        pass: '#pass'
      },
      entry: [
        assign({
          o1: { p1: 'v1', p2: 'v2' }
        })
      ]
    },
    pass: {
      id: 'pass',
      type: 'final'
    },
    fail: {
      id: 'fail',
      type: 'final'
    }
  }
});
