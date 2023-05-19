import { createMachine, raise } from 'xstate';

export default createMachine({
  initial: 'a',
  states: {
    a: {
      id: 'a',
      on: {
        t: {
          target: '#b',
          actions: raise({ type: 's' }),
          reenter: true
        }
      }
    },
    b: {
      id: 'b',
      on: {
        s: {
          target: '#c',
          reenter: true
        }
      }
    },
    c: {
      id: 'c'
    }
  }
});
