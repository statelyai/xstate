// oxlint-disable-next-line typescript/ban-ts-comment
// @ts-nocheck: loaded under xstate@5 by the verify child; typechecked as v6 here.
import { setup } from 'xstate';

// `PICK` dereferences its payload in the guard, so it throws when generated
// without an events file; `NEXT` still drives the machine.
export const machine = setup({
  guards: {
    bigItem: ({ event }) => event.item.size > 3
  }
}).createMachine({
  id: 'picker',
  initial: 'idle',
  states: {
    idle: { on: { NEXT: { target: 'browsing' } } },
    browsing: {
      on: {
        PICK: { target: 'large', guard: 'bigItem' },
        NEXT: { target: 'idle' }
      }
    },
    large: { on: { NEXT: { target: 'done' } } },
    done: { type: 'final' }
  }
});
