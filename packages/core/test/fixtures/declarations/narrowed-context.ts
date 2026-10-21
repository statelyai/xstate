import { setup, types } from '../../../src/index.ts';

const s = setup({
  schemas: {
    context: types<{ draft: string | null }>(),
    events: { GO: types<{ text: string }>() }
  },
  states: {
    reviewing: { schemas: { context: types<{ draft: string }>() } }
  }
});

export const machine = s.createMachine({
  context: { draft: null },
  initial: 'drafting',
  states: {
    drafting: { on: { GO: { target: 'reviewing', context: { draft: 'x' } } } },
    reviewing: {
      on: {
        GO: ({ context }) => ({
          target: 'drafting',
          context: { draft: context.draft }
        })
      }
    }
  }
});
