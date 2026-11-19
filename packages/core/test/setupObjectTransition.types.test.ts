import { expectTypeOf } from 'vitest';
import {
  createActor,
  createAsyncLogic,
  setup,
  types,
  waitFor
} from '../src/index.ts';

const wrapperInputWorker = createAsyncLogic({ run: async () => 42 });

it('types function transitions wrapped in an object with a description', () => {
  const machine = setup({
    schemas: {
      context: types<{ titles: string[] }>(),
      events: { Add: types<{ title: string }>() }
    }
  }).createMachine({
    context: { titles: [] },
    on: {
      Add: {
        description: 'Adds a title',
        to: ({ context, event }) => {
          expectTypeOf(context).toEqualTypeOf<{ titles: string[] }>();
          expectTypeOf(event.type).toEqualTypeOf<'Add'>();
          expectTypeOf(event.title).toEqualTypeOf<string>();
          // @ts-expect-error An Add event does not have this field.
          event.missing;
          return { context: { titles: [...context.titles, event.title] } };
        }
      }
    }
  });
  const actor = createActor(machine).start();
  actor.send({ type: 'Add', title: 'first' });
  expect(actor.getSnapshot().context.titles).toEqual(['first']);
  expect(machine.root.transitions.get('Add')![0].description).toBe(
    'Adds a title'
  );
  actor.stop();
});

it('checks targets returned by an object-wrapped transition function', () => {
  const s = setup({
    schemas: { events: { Go: types<{}>() } },
    states: { idle: {}, done: {} }
  });
  s.createMachine({
    initial: 'idle',
    states: {
      idle: {
        on: {
          // @ts-expect-error The target must be a declared state.
          Go: {
            description: 'Finishes',
            to: () => ({ target: 'nowhere' })
          }
        }
      },
      done: {}
    }
  });
});

it('accepts an object-wrapped function without a description', () => {
  const machine = setup({
    schemas: { events: { Go: types<{}>() } }
  }).createMachine({
    initial: 'idle',
    states: {
      idle: {
        on: {
          Go: {
            to: ({ event }) => {
              expectTypeOf(event.type).toEqualTypeOf<'Go'>();
              return { target: 'done' };
            }
          }
        }
      },
      done: {}
    }
  });
  const actor = createActor(machine).start();
  actor.send({ type: 'Go' });
  expect(actor.getSnapshot().value).toBe('done');
  actor.stop();
});

it('validates targets against states authored in createMachine', () => {
  const s = setup({ schemas: { events: { Go: types<{}>() } } });
  if (false) {
    // @ts-expect-error The returned target is not in the machine topology.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            Go: {
              description: 'Invalid',
              to: () => ({ target: 'nowhere' as const })
            }
          }
        },
        done: {}
      }
    });
  }
});

it('rejects ignored wrapper settings but accepts supported metadata', () => {
  const s = setup({ schemas: { events: { Go: types<{}>() } } });
  if (false) {
    s.createMachine({
      on: {
        // @ts-expect-error Static reenter is ignored when to is present.
        Go: { to: () => ({}), reenter: true }
      }
    });
    s.createMachine({
      on: {
        // @ts-expect-error Static context is ignored when to is present.
        Go: { to: () => ({}), context: {} }
      }
    });
    s.createMachine({
      on: {
        // @ts-expect-error Static target is ignored when to is present.
        Go: { to: () => ({}), target: 'idle' }
      }
    });
  }
  s.createMachine({
    on: {
      Go: {
        to: () => ({}),
        description: 'Supported',
        input: ({ event }) => ({ kind: event.type })
      }
    }
  });
});

it('checks and applies the lifecycle filter on a wrapped transition', async () => {
  const worker = Promise.withResolvers<void>();
  const s = setup({ schemas: { events: { Start: types<{}>() } } });
  if (false) {
    s.createMachine({
      on: {
        // @ts-expect-error Lifecycle actor IDs are strings.
        'xstate.done.actor': {
          matches: { actorId: 123 },
          to: () => ({})
        }
      }
    });
  }

  const machine = s.createMachine({
    initial: 'idle',
    states: {
      idle: { on: { Start: { target: 'loading' } } },
      loading: {
        invoke: [
          { id: 'other', src: createAsyncLogic({ run: async () => {} }) },
          { id: 'worker', src: createAsyncLogic({ run: () => worker.promise }) }
        ]
      },
      ready: {}
    },
    on: {
      'xstate.done.actor': {
        matches: { actorId: 'worker' },
        to: ({ event }) => {
          expectTypeOf(event.actorId).toEqualTypeOf<string>();
          return { target: '.ready' };
        }
      }
    }
  });
  const actor = createActor(machine).start();
  try {
    actor.send({ type: 'Start' });
    const waiting = await waitFor(
      actor,
      (snapshot) => !snapshot.children.other
    );
    expect(waiting.value).toBe('loading');
    worker.resolve();
    await waitFor(actor, (snapshot) => snapshot.matches('ready'));
  } finally {
    actor.stop();
  }
});

it('validates and applies wrapped transitions from createInvoke', async () => {
  const s = setup({});
  const machine = s.createMachine({
    initial: 'loading',
    states: {
      loading: {
        invoke: s.createInvoke({
          src: createAsyncLogic({ run: async () => 42 }),
          onDone: {
            to: ({ event }) => {
              expectTypeOf(event.output).toEqualTypeOf<number>();
              return { target: 'ready' as const };
            }
          }
        })
      },
      ready: {}
    }
  });
  const actor = createActor(machine).start();
  try {
    await waitFor(actor, (snapshot) => snapshot.matches('ready'));
    expect(actor.getSnapshot().value).toBe('ready');
  } finally {
    actor.stop();
  }
});

it('uses wrapper input when a createInvoke transition omits input', () => {
  const s = setup({
    schemas: { context: types<{ x: number }>() },
    states: {
      loading: {},
      ready: { schemas: { input: types<{ value: number }>() } }
    }
  });
  s.createMachine({
    context: { x: 1 },
    initial: 'loading',
    states: {
      loading: {
        invoke: s.createInvoke({
          src: wrapperInputWorker,
          onDone: {
            input: { value: 42 },
            to: () => ({ target: 'ready' as const })
          }
        })
      },
      ready: {}
    }
  });
});
