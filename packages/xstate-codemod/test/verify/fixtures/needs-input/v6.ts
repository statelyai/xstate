import { createMachine, types } from 'xstate';

export const machine = createMachine({
  id: 'needsInput',
  schemas: { input: types<{ start: number }>() },
  initial: 'idle',
  context: ({ input }) => ({ count: input.start }),
  states: {
    idle: { on: { NEXT: { target: 'counting' } } },
    counting: {
      on: {
        INC: ({ context }) => ({ context: { count: context.count + 1 } }),
        NEXT: { target: 'paused' }
      }
    },
    paused: {
      on: { NEXT: { target: 'counting' }, FINISH: { target: 'done' } }
    },
    done: { type: 'final' }
  }
});
