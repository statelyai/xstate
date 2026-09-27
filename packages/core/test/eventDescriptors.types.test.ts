import { z } from 'zod';
import { createMachine, setup } from '../src/index.ts';

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

  it('stays permissive without schemas.events', () => {
    setup({}).createMachine({ on: { anything: () => {} } });
    createMachine({ on: { anything: () => {} } });
    setup({
      schemas: { internalEvents: { tick: z.object({}) } }
    }).createMachine({ on: { anything: {} } });

    expect(true).toBe(true);
  });
});
