import { createAsyncLogic, setup, types } from '../../../src/index.ts';

export const kettle = setup({
  schemas: { context: types<{ level: number }>() },
  actors: {
    gauge: createAsyncLogic<{ reading: number }, { level: number }>({
      run: ({ input }) => Promise.resolve({ reading: input.level })
    })
  }
});

export const heating = kettle.createStateConfig({
  invoke: {
    src: 'gauge',
    input: ({ context }) => ({ level: context.level }),
    onDone: () => ({ target: 'idle' })
  }
});

export const machine = kettle.createMachine({
  context: { level: 0 },
  initial: 'heating',
  states: { heating, idle: {} }
});
