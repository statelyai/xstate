import { Machine, actions } from 'xstate';

const m = Machine({
  initial: 'a',
  states: {
    a: {
      id: 'a',
      on: {
        t: 'b'
      }
    },
    b: {
      entry: actions.raise('s'),
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
