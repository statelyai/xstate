import { createMachine, actions } from 'xstate';

export default createMachine({
  initial: 'a',
  states: {
    a: {
      id: 'a',
      on: {
        t: {
          target: '#b',
          actions: actions.raise({ type: 's' })
        }
      }
    },
    b: {
      id: 'b',
      on: {
        s: '#c'
      }
    },
    c: {
      id: 'c'
    }
  }
});
