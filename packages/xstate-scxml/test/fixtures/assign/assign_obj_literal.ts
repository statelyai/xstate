import { Machine, actions, assign } from 'xstate';

export default Machine<any>({
  initial: 'uber',
  states: {
    uber: {
      id: 'uber',
      on: {
        '*': {
          target: '#fail',
          actions: actions.log(
            (_, e) => `unhandled input ${JSON.stringify(e)}`,
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
