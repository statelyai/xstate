import * as XState from 'xstate';

const deep = {
  XState
};

export const machine = deep.XState.createMachine({
  initial: 'idle',
  states: {
    idle: {}
  }
});
