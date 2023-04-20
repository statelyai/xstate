import { createMachine, raise } from 'xstate';

const m = createMachine({
  initial: 'a',
  states: {
    a: {
      id: 'a',
      exit: raise({ type: 's' }),
      on: {
        t: 'b'
      }
    },
    b: {
      id: 'b',
      on: {
        s: 'c'
      }
    },
    c: {
      id: 'c'
    }
  }
});

export default m;
