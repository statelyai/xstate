import { createMachine, actions } from 'xstate';

export default createMachine({
  initial: 'a',
  states: {
    a: {
      id: 'a',
      on: {
        t: {
          target: '#b',
          actions: actions.raise({ type: 's' }),
          external: true
        }
      }
    },
    b: {
      id: 'b',
      on: {
        s: {
          target: '#c',
          external: true
        }
      }
    },
    c: {
      id: 'c'
    }
  }
});
