import { setup, types } from 'xstate';
import { createAsyncLogic } from 'xstate/actors';

const chargeCard = createAsyncLogic({
  run: async ({ input }: { input: { total: number } }) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (input.total > 500) {
      throw new Error('card declined');
    }
    return { chargeId: `ch-${Math.round(input.total)}` };
  }
});

/** A headless order workflow: no DOM, no framework, no UI code. */
export const orderMachine = setup({
  schemas: {
    context: types<{
      total: number;
      chargeId: string | null;
      error: string | null;
    }>(),
    events: {
      addItem: types<{}>(),
      checkout: types<{}>(),
      retry: types<{}>(),
      cancel: types<{}>()
    }
  },
  actors: { chargeCard },
  guards: {
    hasItems: ({ context }: { context: { total: number } }) => context.total > 0
  }
}).createMachine({
  context: { total: 0, chargeId: null, error: null },
  initial: 'cart',
  states: {
    cart: {
      on: {
        addItem: ({ context }) => ({
          context: { total: context.total + 120 }
        }),
        checkout: ({ context, guards }) =>
          guards.hasItems({ context }) ? { target: 'charging' } : undefined
      }
    },
    charging: {
      invoke: {
        src: ({ actors }) => actors.chargeCard,
        input: ({ context }) => ({ total: context.total }),
        onDone: ({ event }) => ({
          target: 'paid',
          context: { chargeId: event.output.chargeId, error: null }
        }),
        onError: ({ event }) => ({
          target: 'declined',
          context: { error: (event.error as Error).message }
        })
      }
    },
    declined: {
      on: {
        retry: { target: 'charging' },
        cancel: { target: 'cart' }
      }
    },
    paid: {
      type: 'final'
    }
  }
});
