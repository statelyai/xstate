import { createAsyncLogic, setup, types } from 'xstate';

const corpus = [
  'statechart',
  'state machine',
  'stately inspector',
  'actor model',
  'always transition',
  'parallel states',
  'delayed transition',
  'guarded transition',
  'spawned actor',
  'invoked actor',
  'error handling',
  'persistence'
];

/** Stands in for a network request. Queries containing "err" reject. */
const searchCorpus = createAsyncLogic({
  schemas: { input: types<{ query: string }>() },
  run: async ({ input, signal }) => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, 600);
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(signal.reason);
      });
    });

    if (input.query.includes('err')) {
      throw new Error(`Search failed for "${input.query}"`);
    }

    const query = input.query.toLowerCase();

    return corpus.filter((entry) => entry.toLowerCase().includes(query));
  }
});

const DEBOUNCE_ID = 'debounce';

export const searchMachine = setup({
  schemas: {
    context: types<{
      query: string;
      results: string[];
      highlighted: number;
      selected: string | null;
      errorMessage: string | null;
    }>(),
    events: {
      QUERY_CHANGED: types<{ query: string }>(),
      SEARCH: types<{}>(),
      HIGHLIGHT_NEXT: types<{}>(),
      HIGHLIGHT_PREV: types<{}>(),
      CHOOSE: types<{}>(),
      DISMISS: types<{}>()
    }
  },
  actors: { searchCorpus }
}).createMachine({
  id: 'search',
  initial: 'empty',
  context: {
    query: '',
    results: [],
    highlighted: 0,
    selected: null,
    errorMessage: null
  },
  states: {
    empty: {},
    // Waiting out the debounce window. A newer keystroke cancels the pending
    // raised SEARCH event, so only the last one survives.
    debouncing: {},
    searching: {
      invoke: {
        src: 'searchCorpus',
        input: ({ context }) => ({ query: context.query }),
        onDone: ({ context, event }) => ({
          target: event.output.length ? 'results' : 'noResults',
          context: { ...context, results: event.output, highlighted: 0 }
        }),
        onError: ({ context, event }) => ({
          target: 'error',
          context: {
            ...context,
            results: [],
            errorMessage:
              event.error instanceof Error
                ? event.error.message
                : 'Search failed'
          }
        })
      }
    },
    results: {
      on: {
        HIGHLIGHT_NEXT: ({ context }) => ({
          context: {
            ...context,
            highlighted: (context.highlighted + 1) % context.results.length
          }
        }),
        HIGHLIGHT_PREV: ({ context }) => ({
          context: {
            ...context,
            highlighted:
              (context.highlighted - 1 + context.results.length) %
              context.results.length
          }
        }),
        CHOOSE: ({ context }) => ({
          target: 'chosen',
          context: {
            ...context,
            selected: context.results[context.highlighted],
            query: context.results[context.highlighted]
          }
        }),
        DISMISS: { target: 'empty' }
      }
    },
    noResults: {},
    error: {},
    chosen: {}
  },
  on: {
    QUERY_CHANGED: ({ context, event }, enq) => {
      // Re-entering `searching` aborts the in-flight request's `signal`, and
      // cancelling the pending SEARCH drops stale keystrokes.
      enq.cancel(DEBOUNCE_ID);

      const next = {
        ...context,
        query: event.query,
        highlighted: 0,
        selected: null,
        errorMessage: null
      };

      if (event.query.trim() === '') {
        return { target: 'empty', context: { ...next, results: [] } };
      }

      enq.raise({ type: 'SEARCH' }, { id: DEBOUNCE_ID, delay: 300 });

      return { target: 'debouncing', context: next };
    },
    SEARCH: { target: 'searching' },
    DISMISS: ({ context }, enq) => {
      enq.cancel(DEBOUNCE_ID);

      return { target: 'empty', context: { ...context, results: [] } };
    }
  }
});
