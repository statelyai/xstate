import { assign, setup, createActor, enqueueActions } from '../src';
import { createScopedState } from '../src/scopedSetup';

// ============================================================================
// Setup — full machine with all events/actions/guards
// ============================================================================

type AppContext = {
  count: number;
  query: string;
  results: string[];
  selectedIndex: number;
  isLoading: boolean;
};

type CounterEvents =
  | { type: 'INCREMENT' }
  | { type: 'DECREMENT'; by: number }
  | { type: 'RESET' };

type SearchEvents =
  | { type: 'SEARCH'; query: string }
  | { type: 'SEARCH_SUCCESS'; data: string[] }
  | { type: 'SEARCH_FAILURE'; error: string };

type NavigationEvents =
  | { type: 'SELECT'; index: number }
  | { type: 'NAVIGATE_BACK' };

type AllEvents = CounterEvents | SearchEvents | NavigationEvents;

const s = setup({
  types: {
    context: {} as AppContext,
    events: {} as AllEvents
  },
  actions: {
    increment: assign({
      count: ({ context }) => context.count + 1
    }),
    decrement: assign({
      count: ({ context, event }) => {
        return context.count - (event as { type: 'DECREMENT'; by: number }).by;
      }
    }),
    resetCount: assign({ count: 0 }),
    setQuery: assign({
      query: ({ event }) => (event as { type: 'SEARCH'; query: string }).query,
      isLoading: true
    }),
    setResults: assign({
      results: ({ event }) =>
        (event as { type: 'SEARCH_SUCCESS'; data: string[] }).data,
      isLoading: false
    }),
    clearResults: assign({ results: [], isLoading: false }),
    selectItem: assign({
      selectedIndex: ({ event }) =>
        (event as { type: 'SELECT'; index: number }).index
    }),
    goBack: assign({ selectedIndex: -1 })
  },
  guards: {
    isPositive: ({ context }) => context.count > 0,
    isNotZero: ({ context }) => context.count !== 0,
    hasQuery: ({ context }) => context.query.length > 0
  }
});

// ============================================================================
// Scoped state configs — each only sees its relevant events/actions/guards
// ============================================================================

const idle = createScopedState(s, {
  events: ['INCREMENT', 'DECREMENT', 'RESET'],
  actions: ['increment', 'decrement', 'resetCount'],
  guards: ['isPositive'],
  on: {
    INCREMENT: { actions: 'increment' },
    DECREMENT: {
      actions: 'decrement',
      guard: 'isPositive'
    },
    RESET: { actions: 'resetCount' }
  }
});

const searching = createScopedState(s, {
  events: ['SEARCH', 'SEARCH_SUCCESS', 'SEARCH_FAILURE'],
  actions: ['setQuery', 'setResults', 'clearResults'],
  on: {
    SEARCH: { actions: 'setQuery' },
    SEARCH_SUCCESS: { actions: 'setResults', target: 'results' },
    SEARCH_FAILURE: { actions: 'clearResults', target: 'idle' }
  }
});

const results = createScopedState(s, {
  events: ['SELECT', 'NAVIGATE_BACK'],
  actions: ['selectItem', 'goBack'],
  on: {
    SELECT: { actions: 'selectItem' },
    NAVIGATE_BACK: { actions: 'goBack', target: 'idle' }
  }
});

// ============================================================================
// Machine composition — uses setup.createMachine as normal
// ============================================================================

const machine = s.createMachine({
  id: 'app',
  initial: 'idle',
  context: {
    count: 0,
    query: '',
    results: [],
    selectedIndex: -1,
    isLoading: false
  },
  states: {
    idle,
    searching,
    results,
    // Plain (unscoped) states work alongside scoped ones
    error: {
      on: {
        RESET: 'idle'
      }
    }
  }
});

// ============================================================================
// Runtime tests
// ============================================================================

describe('createScopedState', () => {
  it('creates a working machine from scoped state configs', () => {
    const actor = createActor(machine);
    actor.start();

    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.count).toBe(0);
  });

  it('handles events dispatched to scoped states', () => {
    const actor = createActor(machine);
    actor.start();

    actor.send({ type: 'INCREMENT' });
    expect(actor.getSnapshot().context.count).toBe(1);

    actor.send({ type: 'INCREMENT' });
    expect(actor.getSnapshot().context.count).toBe(2);

    actor.send({ type: 'DECREMENT', by: 1 });
    expect(actor.getSnapshot().context.count).toBe(1);
  });

  it('applies guards from scoped states', () => {
    const actor = createActor(machine);
    actor.start();

    // count is 0, guard isPositive should block DECREMENT
    actor.send({ type: 'DECREMENT', by: 5 });
    expect(actor.getSnapshot().context.count).toBe(0); // unchanged

    actor.send({ type: 'INCREMENT' });
    expect(actor.getSnapshot().context.count).toBe(1);

    // now guard passes
    actor.send({ type: 'DECREMENT', by: 1 });
    expect(actor.getSnapshot().context.count).toBe(0);
  });

  it('handles reset action', () => {
    const actor = createActor(machine);
    actor.start();

    actor.send({ type: 'INCREMENT' });
    actor.send({ type: 'INCREMENT' });
    actor.send({ type: 'INCREMENT' });
    expect(actor.getSnapshot().context.count).toBe(3);

    actor.send({ type: 'RESET' });
    expect(actor.getSnapshot().context.count).toBe(0);
  });

  it('returns a plain state config (strips scoping arrays)', () => {
    const stateConfig = createScopedState(s, {
      events: ['INCREMENT'],
      actions: ['increment'],
      guards: ['isPositive'],
      on: {
        INCREMENT: { actions: 'increment' }
      }
    });

    // Should have `on` but NOT `events`, `actions`, `guards`
    expect(stateConfig).toHaveProperty('on');
    expect(stateConfig).not.toHaveProperty('events');
    expect(stateConfig).not.toHaveProperty('actions');
    expect(stateConfig).not.toHaveProperty('guards');
  });

  it('works with no actions or guards specified (all available)', () => {
    const stateConfig = createScopedState(s, {
      events: ['INCREMENT', 'RESET'],
      // actions and guards omitted — all available
      on: {
        INCREMENT: { actions: 'increment' },
        RESET: { actions: 'resetCount' }
      }
    });

    const m = s.createMachine({
      id: 'simple',
      initial: 'only',
      context: {
        count: 0,
        query: '',
        results: [],
        selectedIndex: -1,
        isLoading: false
      },
      states: { only: stateConfig }
    });

    const actor = createActor(m);
    actor.start();

    actor.send({ type: 'INCREMENT' });
    expect(actor.getSnapshot().context.count).toBe(1);
  });

  it('works with entry/exit actions', () => {
    const withEntry = createScopedState(s, {
      events: ['INCREMENT'],
      actions: ['increment', 'resetCount'],
      on: {
        INCREMENT: { actions: 'increment' }
      },
      entry: 'resetCount'
    });

    const m = s.createMachine({
      id: 'entryTest',
      initial: 'main',
      context: {
        count: 5,
        query: '',
        results: [],
        selectedIndex: -1,
        isLoading: false
      },
      states: { main: withEntry }
    });

    const actor = createActor(m);
    actor.start();

    // entry action resets count to 0
    expect(actor.getSnapshot().context.count).toBe(0);
  });

  it('supports array of transitions', () => {
    const withArrayTransitions = createScopedState(s, {
      events: ['INCREMENT'],
      actions: ['increment', 'resetCount'],
      guards: ['isPositive'],
      on: {
        INCREMENT: [
          { guard: 'isPositive', actions: 'increment' },
          { actions: 'resetCount' }
        ]
      }
    });

    const m = s.createMachine({
      id: 'arrayTransitions',
      initial: 'only',
      context: {
        count: 1,
        query: '',
        results: [],
        selectedIndex: -1,
        isLoading: false
      },
      states: { only: withArrayTransitions }
    });

    const actor = createActor(m);
    actor.start();

    // count is 1, isPositive is true → increment
    actor.send({ type: 'INCREMENT' });
    expect(actor.getSnapshot().context.count).toBe(2);
  });

  it('works alongside plain unscoped states', () => {
    const scoped = createScopedState(s, {
      events: ['INCREMENT'],
      on: {
        INCREMENT: { actions: 'increment', target: 'b' }
      }
    });

    const m = s.createMachine({
      id: 'mixed',
      initial: 'a',
      context: {
        count: 0,
        query: '',
        results: [],
        selectedIndex: -1,
        isLoading: false
      },
      states: {
        a: scoped,
        b: {
          on: {
            RESET: { actions: 'resetCount', target: 'a' }
          }
        }
      }
    });

    const actor = createActor(m);
    actor.start();

    actor.send({ type: 'INCREMENT' });
    expect(actor.getSnapshot().value).toBe('b');
    expect(actor.getSnapshot().context.count).toBe(1);

    actor.send({ type: 'RESET' });
    expect(actor.getSnapshot().value).toBe('a');
    expect(actor.getSnapshot().context.count).toBe(0);
  });

  it('types inline action functions with narrowed event per on-key', () => {
    const captured: { context: any; event: any }[] = [];

    const scoped = createScopedState(s, {
      events: ['INCREMENT', 'DECREMENT'],
      on: {
        INCREMENT: {
          actions: ({ context, event }) => {
            // event is narrowed to { type: 'INCREMENT' }
            captured.push({ context, event });
          }
        },
        DECREMENT: {
          actions: ({ context, event }) => {
            // event is narrowed to { type: 'DECREMENT'; by: number }
            captured.push({ context, event });
          }
        }
      }
    });

    const m = s.createMachine({
      id: 'inlineTyped',
      initial: 'only',
      context: {
        count: 0,
        query: '',
        results: [],
        selectedIndex: -1,
        isLoading: false
      },
      states: { only: scoped }
    });

    const actor = createActor(m);
    actor.start();

    actor.send({ type: 'INCREMENT' });
    expect(captured[0]!.event.type).toBe('INCREMENT');
    expect(captured[0]!.context.count).toBe(0);

    actor.send({ type: 'DECREMENT', by: 3 });
    expect(captured[1]!.event.type).toBe('DECREMENT');
    expect(captured[1]!.event.by).toBe(3);
  });

  it('supports enqueueActions as inline action', () => {
    const enqueued: string[] = [];

    const scoped = createScopedState(s, {
      events: ['INCREMENT', 'DECREMENT'],
      actions: ['increment'],
      guards: ['isPositive'],
      on: {
        INCREMENT: {
          actions: enqueueActions(({ context, event, enqueue, check }) => {
            enqueued.push(`inc:${context.count}`);
            if (check('isPositive')) {
              enqueue('increment');
            }
          })
        },
        DECREMENT: {
          actions: enqueueActions(({ context, event, enqueue }) => {
            enqueued.push(`dec:${event.by}`);
            enqueue('decrement');
          })
        }
      }
    });

    const m = s.createMachine({
      id: 'enqueueTest',
      initial: 'only',
      context: {
        count: 1,
        query: '',
        results: [],
        selectedIndex: -1,
        isLoading: false
      },
      states: { only: scoped }
    });

    const actor = createActor(m);
    actor.start();

    actor.send({ type: 'INCREMENT' });
    expect(enqueued).toContain('inc:1');
    expect(actor.getSnapshot().context.count).toBe(2);

    actor.send({ type: 'DECREMENT', by: 1 });
    expect(enqueued).toContain('dec:1');
    expect(actor.getSnapshot().context.count).toBe(1);
  });

  it('types inline guard functions', () => {
    let guardCalled = false;

    const scoped = createScopedState(s, {
      events: ['INCREMENT'],
      on: {
        INCREMENT: {
          guard: ({ context }) => {
            guardCalled = true;
            // context is typed as AppContext
            return context.count < 5;
          },
          actions: 'increment'
        }
      }
    });

    const m = s.createMachine({
      id: 'inlineGuard',
      initial: 'only',
      context: {
        count: 0,
        query: '',
        results: [],
        selectedIndex: -1,
        isLoading: false
      },
      states: { only: scoped }
    });

    const actor = createActor(m);
    actor.start();

    actor.send({ type: 'INCREMENT' });
    expect(guardCalled).toBe(true);
    expect(actor.getSnapshot().context.count).toBe(1);
  });
});
