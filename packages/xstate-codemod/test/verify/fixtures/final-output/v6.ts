import { createMachine } from 'xstate';

export const machine = createMachine({
  id: 'payment',
  initial: 'idle',
  states: {
    idle: { on: { PAY: { target: 'confirmed' } } },
    confirmed: { type: 'final', output: { status: 'paid' } }
  }
});
