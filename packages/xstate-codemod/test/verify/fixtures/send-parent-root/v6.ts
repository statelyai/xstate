import { createMachine } from 'xstate';

export const machine = createMachine({
  id: 'notifier',
  initial: 'ready',
  entry: ({ parent }, enq) => {
    enq.sendTo(parent, { type: 'READY' });
  },
  states: { ready: {} }
});
