import { createMachine, actions } from 'xstate';

export default createMachine<any>({
  initial: 'a',
  states: {
    a: {
      id: 'a',
      on: {
        t: {
          target: 'b',
          actions: actions.raise({ type: 's' })
        }
      }
    },
    b: {
      initial: 'b1',
      states: {
        b1: {
          always: 'b3',
          on: {
            s: 'b2'
          }
        },
        b2: {
          id: 'b2'
        },
        b3: {
          id: 'b3'
        }
      }
    }
  }
});
