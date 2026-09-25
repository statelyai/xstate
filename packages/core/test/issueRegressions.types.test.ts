/**
 * Type-level regression tests for open GitHub issues that are fixed (or made
 * moot) in v6. Each test reproduces the reported pattern with v6 APIs.
 */
import { z } from 'zod';
import {
  createActor,
  createAsyncLogic,
  createMachine,
  setup,
  types,
  type ActorRefFromLogic,
  type AnyActorLogic
} from '../src/index.ts';

function expectType<T>(_v: T) {}

describe('types', () => {
  it('#4915 createActor does not require input when restoring a snapshot', () => {
    const machine = setup({
      schemas: {
        input: z.object({ id: z.string() }),
        context: z.object({ id: z.string() })
      }
    }).createMachine({
      context: ({ input }) => ({ id: input.id })
    });

    const actor = createActor(machine, { input: { id: 'a' } }).start();
    const persisted = actor.getPersistedSnapshot();

    const restored = createActor(machine, { snapshot: persisted }).start();
    expect(restored.getSnapshot().context.id).toBe('a');
  });

  it('#4855 generic actor stubs in setup keep invoke inference', () => {
    function createGenericMachine<Input, Output>() {
      return setup({
        schemas: {
          events: {
            trigger: types<{ input: Input }>()
          }
        },
        actors: {
          resolver: createAsyncLogic({
            run: async (_args: { input: Input }): Promise<Output> => {
              throw new Error('not implemented');
            }
          })
        }
      }).createMachine({
        initial: 'idle',
        on: {
          trigger: { target: '.resolving' }
        },
        states: {
          idle: {},
          resolving: {
            invoke: {
              src: 'resolver',
              input: ({ event }) => event.input,
              onDone: ({ event }) => {
                expectType<Output>(event.output);
                return { target: 'valid' };
              },
              onError: { target: 'invalid' }
            }
          },
          valid: {},
          invalid: {}
        }
      });
    }

    const machine = createGenericMachine<{ in: string }, { out: string }>();
    expect(machine).toBeDefined();
  });

  it('#4925 snapshot.value includes compound state values', () => {
    const machine = setup({}).createMachine({
      initial: 'a',
      states: {
        a: {
          initial: 'x',
          states: { x: {}, y: {} }
        },
        b: {}
      }
    });

    const value = createActor(machine).getSnapshot().value;
    value satisfies typeof value;

    const compound: typeof value = { a: 'x' };
    const atomic: typeof value = 'b';
    // @ts-expect-error - 'z' is not a child of 'a'
    const invalid: typeof value = { a: 'z' };

    expect([compound, atomic, invalid]).toHaveLength(3);
  });

  it('#4913 each invoked child ref is typed with its own events', () => {
    const childA = createMachine({
      schemas: { events: { onlyA: types<{}>() } }
    });
    const childB = createMachine({
      schemas: { events: { onlyB: types<{}>() } }
    });

    // Reported pattern: events unique to one child are no longer rejected
    const untyped = setup({
      actors: { childA, childB }
    }).createMachine({
      invoke: [
        { id: 'a', src: 'childA' },
        { id: 'b', src: 'childB' }
      ]
    });
    createActor(untyped).getSnapshot().children.a?.send({ type: 'onlyA' });

    // With `schemas.children`, each ref gets exactly its own events
    const typed = setup({
      actors: { childA, childB },
      schemas: {
        children: {
          a: types<ActorRefFromLogic<typeof childA>>(),
          b: types<ActorRefFromLogic<typeof childB>>()
        }
      }
    }).createMachine({
      invoke: [
        { id: 'a', src: 'childA' },
        { id: 'b', src: 'childB' }
      ]
    });
    const children = createActor(typed).getSnapshot().children;

    children.a?.send({ type: 'onlyA' });
    children.b?.send({ type: 'onlyB' });
    // @ts-expect-error - onlyB belongs to child b
    children.a?.send({ type: 'onlyB' });
  });

  it('#5375 after keys must be declared delays', () => {
    const s = setup({
      delays: { someDelay: 10000 }
    });

    s.createMachine({
      initial: 'sleep',
      states: {
        sleep: { after: { someDelay: { target: 'awake' } } },
        awake: {}
      }
    });

    // @ts-expect-error - slotDuration222 is not a declared delay
    s.createMachine({
      initial: 'sleep',
      states: {
        sleep: { after: { slotDuration222: { target: 'awake' } } },
        awake: {}
      }
    });
  });

  it('#4802 enq.spawn accepts dynamic logic when actors are declared', () => {
    const known = createMachine({});
    const dynamicLogic = createMachine({}) as AnyActorLogic;

    setup({ actors: { known } }).createMachine({
      entry: (_, enq) => {
        enq.spawn('known');
        enq.spawn(dynamicLogic);
      }
    });
  });

  it('#4853 unknown keys in a transition object are rejected', () => {
    setup({
      schemas: {
        events: { RUN: types<{}>() },
        context: types<{}>()
      }
    }).createMachine({
      context: {},
      initial: 'idle',
      states: {
        idle: {
          on: {
            // @ts-expect-error - `thing` is not a transition property
            RUN: { thing: 'stop' }
          }
        },
        stop: {}
      }
    });
  });

  it('#5024 spawned child input sees the narrowed event', () => {
    const child = createMachine({
      schemas: { input: z.object({ n: z.number() }) }
    });

    setup({
      schemas: {
        events: {
          foo: types<{ value: string }>(),
          bar: types<{}>()
        }
      },
      actors: { child }
    }).createMachine({
      on: {
        foo: ({ event }, enq) => {
          enq.spawn('child', { input: { n: event.value.length } });
        }
      }
    });
  });

  it('#4725 sendTo accepts a plain event object with payload', () => {
    const childMachine = createMachine({
      schemas: {
        events: { notify: types<{ data: string }>() }
      }
    });

    setup({
      schemas: { events: { someEvent: types<{}>() } },
      actors: { childMachine }
    }).createMachine({
      invoke: { src: 'childMachine', registryKey: 'childMachine' },
      on: {
        someEvent: ({ system }, enq) => {
          enq.sendTo(system.get('childMachine'), {
            type: 'notify',
            data: 'error'
          });
        }
      }
    });
  });
});
