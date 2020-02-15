import { Machine, actions } from 'xstate';

export default Machine<any>({
  initial: 'a',
  states: {
    a: {
      id: 'a',
      on: {
        t: {
          target: '#b',
          actions: actions.raise('s')
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
