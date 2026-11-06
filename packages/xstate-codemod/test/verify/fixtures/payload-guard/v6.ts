import { createMachine } from 'xstate';

export const machine = createMachine({
  id: 'picker',
  initial: 'idle',
  states: {
    idle: { on: { NEXT: { target: 'browsing' } } },
    browsing: {
      on: {
        PICK: ({ event }) =>
          (event as unknown as { item: { size: number } }).item.size > 3
            ? { target: 'large' }
            : undefined,
        NEXT: { target: 'idle' }
      }
    },
    large: { on: { NEXT: { target: 'done' } } },
    done: { type: 'final' }
  }
});
