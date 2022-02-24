import { Machine, assign, actions } from 'xstate';

const { log } = actions;

export default Machine<any>({
  initial: 'uber',
  context: {
    o1: undefined
  },
  states: {
    uber: {
      initial: 's1',
      on: {
        'error.execution': 'pass',
        '*': {
          target: 'fail',
          actions: log('unhandled input', 'TEST')
        }
      },
      states: {
        s1: {
          entry: [
            log('Starting session', 'TEST'),
            assign({
              // tslint:disable-next-line:no-eval
              o1: () => eval('{p1: "v1"')
            })
          ]
        }
      }
    },
    pass: {
      id: 'pass',
      type: 'final'
    },
    fail: {
      entry: log('RESULT: fail', 'TEST')
    }
  }
});
