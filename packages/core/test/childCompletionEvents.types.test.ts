import { z } from 'zod';
import {
  assertEvent,
  createActor,
  createAsyncLogic,
  createMachine,
  setup,
  type ActorRefFrom
} from '../src/index.ts';

describe('inferred named invoke children', () => {
  it('types a literal child id from its registered source', () => {
    const child = setup({
      schemas: { events: { go: z.object({}) } }
    }).createMachine({
      initial: 'waiting',
      states: { waiting: { on: { go: { target: 'done' } } }, done: {} }
    });
    const parent = setup({ actors: { child } }).createMachine({
      initial: 'active',
      states: { active: { invoke: { id: 'kid', src: 'child' } } }
    });
    const kid = createActor(parent).getSnapshot().children.kid;
    kid?.send({ type: 'go' });
    // @ts-expect-error - only child events are accepted
    kid?.send({ type: 'wrong' });
    // @ts-expect-error - the child's snapshot is typed
    const wrongStatus: 'wrong' = kid?.getSnapshot().status;
    void wrongStatus;
  });

  it('types a nested inline invoke in an array', () => {
    const child = setup({
      schemas: { events: { go: z.object({}) } }
    }).createMachine({ initial: 'idle', states: { idle: {} } });
    const parent = setup({}).createMachine({
      initial: 'active',
      states: {
        active: { invoke: [{ id: 'kid', src: child }] }
      }
    });
    const kid = createActor(parent).getSnapshot().children.kid;
    kid?.send({ type: 'go' });
    // @ts-expect-error - only child events are accepted
    kid?.send({ type: 'wrong' });
  });

  it('types an invoke created with setup.createInvoke', () => {
    const child = setup({
      schemas: { events: { go: z.object({}) } }
    }).createMachine({ initial: 'idle', states: { idle: {} } });
    const s = setup({});
    const parent = s.createMachine({
      initial: 'active',
      states: {
        active: { invoke: s.createInvoke({ id: 'kid', src: child }) }
      }
    });
    const kid = createActor(parent).getSnapshot().children.kid;
    kid?.send({ type: 'go' });
    // @ts-expect-error - only child events are accepted
    kid?.send({ type: 'wrong' });
  });

  it('types root and nested invokes in standalone createMachine', () => {
    const child = setup({
      schemas: { events: { go: z.object({}) } }
    }).createMachine({ initial: 'idle', states: { idle: {} } });
    const root = createMachine({
      actors: { child },
      invoke: { id: 'rootKid', src: 'child' }
    });
    const rootKid = createActor(root).getSnapshot().children.rootKid;
    // @ts-expect-error - the root child may be absent before or after its lifetime
    rootKid.send({ type: 'go' });
    rootKid?.send({ type: 'go' });
    // @ts-expect-error - only child events are accepted
    rootKid?.send({ type: 'wrong' });

    const nested = createMachine({
      schemas: { context: z.object({ count: z.number() }) },
      context: { count: 0 },
      actors: { child },
      initial: 'active',
      states: {
        active: { invoke: { id: 'nestedKid', src: 'child' } }
      }
    });
    const nestedKid = createActor(nested).getSnapshot().children.nestedKid;
    // @ts-expect-error - the nested child may be absent outside its state
    nestedKid.send({ type: 'go' });
    nestedKid?.send({ type: 'go' });
    // @ts-expect-error - only child events are accepted
    nestedKid?.send({ type: 'wrong' });
  });

  it('types literal union IDs and source resolver functions', () => {
    const child = setup({
      schemas: { events: { go: z.object({}) } }
    }).createMachine({ initial: 'idle', states: { idle: {} } });
    const id: 'first' | 'second' = Math.random() > 0.5 ? 'first' : 'second';
    const parent = setup({ actors: { child } }).createMachine({
      invoke: { id, src: () => 'child' as const }
    });
    const children = createActor(parent).getSnapshot().children;
    children.first?.send({ type: 'go' });
    children.second?.send({ type: 'go' });
    // @ts-expect-error - either ID still has the child's event type
    children.first?.send({ type: 'wrong' });
    // @ts-expect-error - either ID still has the child's event type
    children.second?.send({ type: 'wrong' });
  });
});

function expectType<T>(_v: T) {}

const fetchUser = createAsyncLogic({
  schemas: { output: z.object({ name: z.string() }) },
  run: async () => ({ name: 'David' })
});

const children = {
  fetch: z.custom<ActorRefFrom<typeof fetchUser>>()
};

describe('child completion events in resolver event unions', () => {
  it('includes done/error events of declared children in entry', () => {
    setup({
      actors: { fetchUser },
      schemas: {
        events: { go: z.object({ to: z.string() }) },
        children
      }
    }).createMachine({
      invoke: { id: 'fetch', src: 'fetchUser' },
      entry: ({ event }) => {
        assertEvent(event, 'xstate.done.actor');
        expectType<'fetch'>(event.actorId);
        expectType<string>(event.output.name);
      },
      exit: ({ event }) => {
        if (event.type === 'xstate.error.actor') {
          expectType<'fetch'>(event.actorId);
          expectType<unknown>(event.error);
        }
      }
    });

    createMachine({
      schemas: {
        events: { go: z.object({}) },
        children
      },
      invoke: { id: 'fetch', src: fetchUser },
      entry: ({ event }) => {
        assertEvent(event, 'xstate.done.actor');
        expectType<string>(event.output.name);
      }
    });

    expect(true).toBe(true);
  });

  it('keeps `on` handlers narrowed to their event', () => {
    setup({
      schemas: {
        events: { go: z.object({ to: z.string() }) },
        children
      }
    }).createMachine({
      on: {
        go: ({ event }) => {
          expectType<{ type: 'go'; to: string }>(event);
          // @ts-expect-error - `go` handlers never see completion events
          event.output;
        },
        'xstate.done.actor': ({ event }) => {
          expectType<string>(event.output.name);
        }
      }
    });

    expect(true).toBe(true);
  });

  it('narrows completion events when only children are declared', () => {
    setup({
      actors: { fetchUser },
      schemas: { children }
    }).createMachine({
      invoke: { id: 'fetch', src: 'fetchUser' },
      entry: ({ event }) => {
        assertEvent(event, 'xstate.done.actor');
        expectType<'fetch'>(event.actorId);
        expectType<string>(event.output.name);
      },
      on: {
        go: ({ event }) => {
          expectType<{ type: string }>(event);
          // @ts-expect-error - `go` handlers never see completion events
          event.output;
        }
      }
    });

    createMachine({
      schemas: { children },
      invoke: { id: 'fetch', src: fetchUser },
      entry: ({ event }) => {
        assertEvent(event, 'xstate.done.actor');
        expectType<'fetch'>(event.actorId);
        expectType<string>(event.output.name);
      }
    });

    expect(true).toBe(true);
  });

  it('does not add completion events without declared children', () => {
    setup({
      schemas: { events: { go: z.object({}) } }
    }).createMachine({
      entry: ({ event }) => {
        expectType<{ type: 'go' }>(event);
      }
    });

    expect(true).toBe(true);
  });
});

describe('inline invoke source', () => {
  it('types onDone event.output as unknown, not any, when the logic is not registered', () => {
    const leaf = setup({}).createMachine({
      initial: 'a',
      states: { a: {}, b: { type: 'final', output: { ok: true as const } } }
    });
    setup({}).createMachine({
      initial: 'a',
      states: {
        a: {
          invoke: {
            src: leaf,
            onDone: ({ event }) => {
              const output: unknown = event.output;
              // @ts-expect-error output is unknown: narrow it, or register the logic / use createInvoke
              event.output.ok;
              void output;
              return { target: 'b' };
            }
          }
        },
        b: { type: 'final' }
      }
    });
  });
});
