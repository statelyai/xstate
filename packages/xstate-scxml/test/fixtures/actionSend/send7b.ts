import { createMachine, raise } from 'xstate';

export default createMachine({
  initial: 'a',
  states: {
    a: {
      id: 'a',
      on: {
        t: {
          target: 'b',
          actions: raise({ type: 's' })
        }
      }
    },
    b: {
      initial: 'b1',
      states: {
        b1: {
          on: {
            s: 'b2'
          }
        },
        b2: {
          id: 'b2'
        },
        b3: {}
      }
    }
  }
});
