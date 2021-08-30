import { createMachine } from 'xstate';

export const machine = createMachine({
  initial: 'wow',
  states: {
    wow: {}
  }
});

const Component = () => {
  return <div></div>;
};
