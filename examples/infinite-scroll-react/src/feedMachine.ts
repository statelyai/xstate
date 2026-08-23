import { createAsyncLogic, setup, types } from 'xstate';

export interface Item {
  id: string;
  title: string;
}

const PAGE_SIZE = 8;
const LAST_PAGE = 5;

let page3Attempts = 0;

/** Mock backend: a delayed page of items. Page 3 fails the first time. */
const fetchPage = createAsyncLogic({
  schemas: { input: types<{ page: number }>() },
  run: async ({ input }) => {
    await new Promise((resolve) => setTimeout(resolve, 600));

    if (input.page === 3 && page3Attempts++ === 0) {
      throw new Error(`Page ${input.page} failed. Try again.`);
    }

    const items: Item[] = Array.from({ length: PAGE_SIZE }, (_, index) => {
      const n = (input.page - 1) * PAGE_SIZE + index + 1;
      return { id: `item-${n}`, title: `Item ${n}` };
    });

    return { items, hasMore: input.page < LAST_PAGE };
  }
});

export const feedMachine = setup({
  schemas: {
    context: types<{
      items: Item[];
      page: number;
      errorMessage: string | null;
    }>(),
    events: {
      LOAD_MORE: types<{}>(),
      RETRY: types<{}>()
    }
  },
  actors: { fetchPage }
}).createMachine({
  id: 'feed',
  initial: 'idle',
  context: {
    items: [],
    page: 1,
    errorMessage: null
  },
  states: {
    idle: {
      on: {
        LOAD_MORE: { target: 'loadingPage' }
      }
    },
    loadingPage: {
      invoke: {
        src: 'fetchPage',
        input: ({ context }) => ({ page: context.page }),
        onDone: ({ context, event }) => ({
          // The next page is only requested once this one is appended
          target: event.output.hasMore ? 'idle' : 'end',
          context: {
            items: context.items.concat(event.output.items),
            page: context.page + 1,
            errorMessage: null
          }
        }),
        onError: ({ context, event }) => ({
          target: 'error',
          context: {
            ...context,
            errorMessage:
              event.error instanceof Error
                ? event.error.message
                : 'Unknown error'
          }
        })
      }
    },
    error: {
      on: {
        // The page number was never advanced, so this re-requests the same page
        RETRY: { target: 'loadingPage' }
      }
    },
    end: {
      type: 'final'
    }
  }
});
