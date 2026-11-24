// oxlint-disable-next-line typescript/ban-ts-comment
// @ts-nocheck: loaded under xstate@5 by the verify child; typechecked as v6 here.
import { createMachine, sendParent } from 'xstate';

export const machine = createMachine({
  id: 'notifier',
  initial: 'ready',
  entry: sendParent({ type: 'READY' }),
  states: { ready: {} }
});
