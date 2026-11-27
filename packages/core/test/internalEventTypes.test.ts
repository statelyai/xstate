import {
  createActor,
  createAsyncLogic,
  createMachine,
  initialTransition,
  setup,
  types
} from '../src/index';
import { expectTypeOf } from 'vitest';

it('types entry and exit events independently of the public send contract', async () => {
  const seen: string[] = [];
  const machine = setup({
    schemas: { events: { PING: types<{ n: number }>() } },
    actors: { work: createAsyncLogic({ run: async () => 42 }) }
  }).createMachine({
    initial: 'loading',
    states: {
      loading: {
        entry: ({ event, self }) => {
          // @ts-expect-error Initial entry has no public payload.
          event.n satisfies number;
          if (event.type === 'xstate.init') {
            expectTypeOf(event.input).toBeUnknown();
            seen.push(event.type);
          }
          if (false) {
            self.send({ type: 'PING', n: 1 });
            self.send({
              // @ts-expect-error Internal events are not public sendable events.
              type: 'xstate.done.actor',
              output: 42,
              actorId: 'work',
              sessionId: 'session'
            });
          }
        },
        exit: ({ event }) => {
          // @ts-expect-error Completion exit has no public payload.
          event.n satisfies number;
          if (event.type === 'xstate.done.actor') {
            expectTypeOf(event.output).toBeUnknown();
            seen.push(event.type);
          }
        },
        invoke: {
          id: 'work',
          src: 'work',
          onDone: ({ event }) => {
            event.output satisfies number;
            // @ts-expect-error Completion output is not a string.
            event.output satisfies string;
            return { target: 'done' };
          }
        }
      },
      done: {
        type: 'final',
        entry: ({ event }) => {
          // @ts-expect-error Completion entry has no public payload.
          event.n satisfies number;
          expect(event.type).toBe('xstate.done.actor');
          seen.push(event.type);
        }
      }
    }
  });
  const actor = createActor(machine);
  await new Promise<void>((resolve) => {
    actor.subscribe({ complete: resolve });
    actor.start();
  });
  expect(seen).toEqual([
    'xstate.init',
    'xstate.done.actor',
    'xstate.done.actor'
  ]);
  if (false) {
    actor.send({ type: 'PING', n: 1 });
    // @ts-expect-error Public payload remains required.
    actor.send({ type: 'PING' });
    // @ts-expect-error Runtime event union does not widen actor.send.
    actor.send({ type: 'xstate.init', input: undefined });
  }
});

it('includes runtime events in eventless, wildcard and resolver callbacks', () => {
  const s = setup({
    schemas: { events: { PING: types<{ n: number }>() } },
    actors: {
      work: createAsyncLogic({
        schemas: { input: types<number>(), error: types<{ code: string }>() },
        run: async ({ input }) => input
      })
    },
    delays: {
      wait: ({ event }) => {
        // @ts-expect-error A delay can be scheduled by an internal event.
        event.n satisfies number;
        return event.type === 'PING' ? event.n : 1;
      }
    }
  });
  s.createMachine({
    initial: 'idle',
    states: {
      idle: {
        id: 'idle',
        route: ({ event }) => {
          event.type satisfies 'xstate.route';
          event.to satisfies string;
          // @ts-expect-error Route callbacks receive the route event.
          event.n satisfies number;
          return true;
        },
        on: {
          PING: ({ event }) => {
            event.n satisfies number;
            // @ts-expect-error A public transition remains narrowly typed.
            event.output;
          },
          '*': ({ event }) => {
            // @ts-expect-error Wildcards can match internal events.
            event.n satisfies number;
            if (event.type === 'xstate.done.state') {
              event.stateId satisfies string;
              expectTypeOf(event.output).toBeUnknown();
            }
          }
        },
        always: ({ event }) => {
          // @ts-expect-error Eventless transitions can follow internal events.
          event.n satisfies number;
          if (event.type === 'xstate.after') {
            event.delay satisfies number | string;
          }
        },
        timeout: ({ event }) => {
          // @ts-expect-error A state timer can be scheduled by an internal event.
          event.n satisfies number;
          return 1;
        },
        onTimeout: ({ event }) => {
          event.type satisfies 'xstate.timeout.state';
        },
        invoke: {
          src: ({ event }) => {
            // @ts-expect-error Source resolution can follow an internal event.
            event.n satisfies number;
            return 'work';
          },
          input: ({ event }) => {
            // @ts-expect-error Invoke input can follow an internal event.
            event.n satisfies number;
            return event.type === 'PING' ? event.n : 0;
          },
          timeout: ({ event }) => {
            // @ts-expect-error Invoke timeout can follow an internal event.
            event.n satisfies number;
            return 1;
          },
          onTimeout: ({ event }) => {
            event.type satisfies 'xstate.timeout.actor';
            event.actorId satisfies string;
          }
        }
      }
    }
  });
  s.createMachine({
    invoke: {
      src: 'work',
      input: 1,
      onError: ({ event }) => {
        event.error.code satisfies string;
        // @ts-expect-error Error payload stays specific to the invoked actor.
        event.error.code satisfies number;
      }
    }
  });
});

it('types choice, final output and initial input callbacks with runtime events', () => {
  const machine = createMachine({
    schemas: { events: { PING: types<{ n: number }>() } },
    initial: {
      target: 'choice',
      input: ({ event }) => {
        // @ts-expect-error Initial input is not necessarily a public event.
        event.n satisfies number;
        return {};
      }
    },
    states: {
      choice: {
        type: 'choice',
        choice: ({ event }) => {
          // @ts-expect-error Choices can be entered on internal events.
          event.n satisfies number;
          return { target: 'done' };
        }
      },
      done: {
        type: 'final',
        output: ({ event }) => {
          // @ts-expect-error Final output can follow an internal event.
          event.n satisfies number;
          return event.type;
        }
      }
    }
  });
  expect(initialTransition(machine)[0].status).toBe('done');
});

it('types reusable state configs and invoke helpers with runtime events', () => {
  const work = createAsyncLogic({
    schemas: { input: types<number>() },
    run: async ({ input }) => input
  });
  const s = setup({
    schemas: {
      events: { PING: types<{ n: number }>() },
      internalEvents: { tick: types<{ count: number }>() }
    }
  });
  const state = s.createStateConfig({
    entry: ({ event }) => {
      // @ts-expect-error Reusable state configs can receive internal events.
      event.n satisfies number;
      if (event.type === 'tick') {
        event.count satisfies number;
      }
    }
  });
  const machine = s.createMachine({
    initial: 'loading',
    states: {
      loading: {
        ...state,
        invoke: s.createInvoke({
          src: work,
          input: ({ event }) => {
            // @ts-expect-error Helper input resolvers can receive internal events.
            event.n satisfies number;
            return event.type === 'PING' ? event.n : 0;
          },
          onDone: ({ event }) => {
            event.output satisfies number;
            // @ts-expect-error Helper completion output remains precise.
            event.output satisfies string;
          }
        })
      }
    }
  });
  if (false) {
    // @ts-expect-error Declared internal events remain private.
    createActor(machine).send({ type: 'tick', count: 1 });
  }
});

it('does not assume catch-all schema payloads exist on runtime events', () => {
  setup({
    schemas: { events: { '*': types<{ n: number }>() } }
  }).createMachine({
    entry: ({ event }) => {
      // @ts-expect-error Runtime initialization does not have the catch-all payload.
      event.n satisfies number;
    }
  });
});
