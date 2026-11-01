// oxlint-disable-next-line typescript/ban-ts-comment
// @ts-nocheck: loaded under xstate@5 by the verify child; typechecked as v6 here.
import { createMachine } from 'xstate';

export const machine = createMachine({
  id: 'payment',
  initial: 'idle',
  states: {
    idle: { on: { PAY: { target: 'confirmed' } } },
    confirmed: { type: 'final', output: { status: 'paid' } }
  }
});
