import { z } from 'zod';
import { createAsyncLogic, createMachine, setup } from '../src/index.ts';

function expectType<T>(_v: T) {}

describe('event descriptor keys in `on`', () => {
  const s = setup({
    schemas: {
      events: {
        go: z.object({ to: z.string() }),
        'user.login': z.object({}),
        'user.logout': z.object({})
      },
      internalEvents: {
        tick: z.object({})
      }
    }
  });

  it('rejects undeclared event keys when schemas.events is declared (setup)', () => {
    if (false) {
      s.createMachine({
        // @ts-expect-error - `TYPO` is not a declared event type
        on: { TYPO: () => {} }
      });

      s.createMachine({
        on: {
          go: {},
          // @ts-expect-error - `TYPO` is not a declared event type
          TYPO: {}
        }
      });

      s.createMachine({
        on: {
          '*': {},
          // @ts-expect-error - `TYPO` is not a declared event type
          TYPO: {}
        }
      });

      s.createMachine({
        initial: 'a',
        states: {
          a: {
            // @ts-expect-error - `TYPO` is not a declared event type
            on: { TYPO: { target: 'b' } }
          },
          b: {}
        }
      });

      s.createMachine({
        // @ts-expect-error - `oops.*` matches no declared event type
        on: { 'oops.*': {} }
      });
    }

    expect(true).toBe(true);
  });

  it('rejects undeclared event keys when schemas.events is declared (createMachine)', () => {
    if (false) {
      createMachine({
        schemas: { events: { go: z.object({}) } },
        on: {
          // @ts-expect-error - `TYPO` is not a declared event type
          TYPO: () => {}
        }
      });

      createMachine({
        schemas: { events: { go: z.object({}) } },
        on: {
          go: {},
          // @ts-expect-error - `TYPO` is not a declared event type
          TYPO: {}
        }
      });

      createMachine({
        schemas: { events: { go: z.object({}) } },
        initial: 'a',
        states: {
          a: {
            // @ts-expect-error - `TYPO` is not a declared event type
            on: { TYPO: {} }
          }
        }
      });
    }

    expect(true).toBe(true);
  });

  it('accepts declared, internal, wildcard and xstate.* descriptors', () => {
    s.createMachine({
      on: {
        go: ({ event }) => {
          expectType<string>(event.to);
        },
        tick: {},
        'user.*': {},
        '*': {},
        'xstate.done.actor': {},
        'xstate.error.actor': {},
        'xstate.error.actor.*': ({ event }) => {
          expectType<`xstate.${string}`>(event.type);
        },
        // @ts-expect-error unknown reserved prefixes are rejected
        'xstate.custom.*': {},
        'xstate.done.state': {},
        'xstate.after': {}
      }
    });

    createMachine({
      schemas: { events: { go: z.object({}) } },
      on: { go: {}, '*': {}, 'xstate.done.actor': {} }
    });

    expect(true).toBe(true);
  });

  it('checks state configs without rejecting reserved descriptors', () => {
    s.createStateConfig({
      on: {
        'xstate.error.actor.*': ({ event }) => {
          expectType<string>(event.type);
        }
      }
    });
    if (false) {
      s.createStateConfig({
        on: {
          go: {},
          // @ts-expect-error undeclared event beside a declared event
          TYPO: {}
        }
      });
    }
  });

  it('stays permissive without schemas.events', () => {
    setup({}).createMachine({ on: { anything: () => {} } });
    createMachine({
      on: {
        anything: () => {},
        'xstate.done.actor.child': ({ children, event }, enq) => {
          expectType<string>(event.type);
          expectType<unknown>(children);
          expectType<Function>(enq);
        }
      }
    });
    setup({
      schemas: { internalEvents: { tick: z.object({}) } }
    }).createMachine({ on: { anything: {} } });

    expect(true).toBe(true);
  });
});

it('narrows bare reserved descriptors and retains registered actor output', () => {
  const s = setup({
    schemas: { events: { GO: z.object({}) } },
    actors: {
      worker: createAsyncLogic({ run: () => Promise.resolve({ ok: true }) })
    }
  });
  s.createMachine({
    initial: 'working',
    states: { working: { invoke: { id: 'worker', src: 'worker' } } },
    on: {
      'xstate.error.actor': ({ event }) => {
        expectType<unknown>(event.error);
        expectType<'xstate.error.actor'>(event.type);
      },
      'xstate.done.actor': ({ event }) => {
        expectType<unknown>(event.output);
        expectType<string>(event.actorId);
      },
      'xstate.snapshot.actor': ({ event }) => {
        expectType<string>(event.snapshot.status);
      },
      'xstate.done.state': ({ event }) => {
        expectType<string>(event.stateId);
      },
      'xstate.after': ({ event }) => {
        expectType<string | number>(event.delay);
      },
      'xstate.timeout': ({ event }) => {
        expectType<string>(event.stateId);
      },
      'xstate.timeout.actor': ({ event }) => {
        expectType<string>(event.actorId);
      },
      'xstate.done.actor.worker': ({ event }) => {
        expectType<boolean>(event.output.ok);
      },
      'xstate.snapshot.child': ({ event }) => {
        expectType<string>(event.snapshot.status);
      }
    }
  });
  if (false) {
    s.createMachine({
      on: {
        // @ts-expect-error misspelled reserved event descriptor
        'xstate.eror.actor': () => {}
      }
    });
    s.createMachine({
      on: {
        // @ts-expect-error invented reserved event descriptor
        'xstate.totally.made.up.key': () => {}
      }
    });
  }
});
