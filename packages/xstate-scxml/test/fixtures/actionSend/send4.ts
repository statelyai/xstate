import { createMachine, raise } from 'xstate';

const m = createMachine({
  initial: 'a',
  states: {
    a: {
      id: 'a',
      on: { t: 'b' }
    },
    b: {
      entry: raise({ type: 's' }),
      always: 'f1',
      on: {
        s: 'c'
      }
    },
    c: {
      always: 'd',
      on: {
        s: 'f2'
      }
    },
    f1: {
      id: 'f1'
    },
    d: {},
    f2: {}
  }
});

export default m;
