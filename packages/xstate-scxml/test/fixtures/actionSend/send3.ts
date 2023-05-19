import { createMachine, raise } from 'xstate';

const m = createMachine({
  initial: 'a',
  states: {
    a: {
      id: 'a',
      on: {
        t: 'b'
      }
    },
    b: {
      entry: raise({ type: 's' }),
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
