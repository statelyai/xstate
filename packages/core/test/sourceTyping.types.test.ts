import { z } from 'zod';
import {
  createMachine,
  setup,
  type ActorRefFrom,
  type ActorFromLogic
} from '../src/index.ts';

function expectType<T>(_v: T) {}

describe('setup() source typing', () => {
  it('contextually types guards and delays from schemas', () => {
    setup({
      schemas: {
        context: z.object({ count: z.number() }),
        events: {
          INC: z.object({ by: z.number() }),
          RESET: z.object({})
        }
      },
      guards: {
        isPositive: ({ context, event }) => {
          expectType<{ count: number }>(context);
          expectType<{ type: 'INC'; by: number } | { type: 'RESET' }>(event);
          return context.count > 0;
        },
        // additional params after the args object are free-form
        isAbove: ({ context }, threshold: number) => context.count > threshold
      },
      delays: {
        backoff: ({ context, event }) => {
          expectType<{ count: number }>(context);
          expectType<{ type: 'INC'; by: number } | { type: 'RESET' }>(event);
          return context.count * 100;
        },
        fixed: 500
      }
    });
  });

  it('rejects guards that do not accept the args object first', () => {
    if (false) {
      setup({
        schemas: {
          context: z.object({ count: z.number() })
        },
        guards: {
          // @ts-expect-error - guard sources receive (args, ...params)
          positional: (count: number) => count > 0
        }
      });
    }
  });

  it('accepts loosely-typed guards and delays without schemas', () => {
    setup({
      guards: {
        anyContext: ({ context }) => context.whatever === true
      },
      delays: {
        slow: ({ context }) => context.ms ?? 1000
      }
    });
  });

  it('contextually types extend() guards and delays from base schemas', () => {
    setup({
      schemas: {
        context: z.object({ count: z.number() })
      }
    }).extend({
      guards: {
        isPositive: ({ context }) => {
          expectType<{ count: number }>(context);
          return context.count > 0;
        }
      },
      delays: {
        backoff: ({ context }) => {
          expectType<{ count: number }>(context);
          return context.count * 100;
        }
      }
    });
  });

  it('contextually types machine-level guards from machine schemas', () => {
    createMachine({
      schemas: {
        context: z.object({ ok: z.boolean() })
      },
      context: { ok: true },
      guards: {
        isOk: ({ context }) => {
          expectType<{ ok: boolean }>(context);
          return context.ok;
        }
      },
      initial: 'a',
      states: { a: {} }
    });
  });

  it('preserves guard signatures for callers via args.guards', () => {
    createMachine({
      schemas: {
        context: z.object({ count: z.number() })
      },
      context: { count: 0 },
      guards: {
        isAbove: (_args, threshold: number) => _args.context.count > threshold
      },
      initial: 'a',
      states: {
        a: {
          on: {
            EV: (args) => {
              if (args.guards.isAbove(args, 3)) {
                return { target: 'b' };
              }
            }
          }
        },
        b: {}
      }
    });
  });
});

describe('spawned actor refs as consumer ActorRefs', () => {
  const child = createMachine({
    schemas: {
      context: z.object({ n: z.number() }),
      events: { PING: z.object({ x: z.number() }) }
    },
    context: { n: 0 },
    initial: 'a',
    states: { a: { on: { PING: () => {} } } }
  });

  it('allows ActorRefFrom-typed refs with enq.spawn/stop/sendTo/listen/subscribeTo', () => {
    createMachine({
      schemas: {
        context: z.object({
          ref: z.custom<ActorRefFrom<typeof child> | undefined>()
        })
      },
      context: { ref: undefined },
      initial: 'a',
      states: {
        a: {
          on: {
            GO: (_args, enq) => {
              const ref = enq.spawn(child);
              expectType<ActorRefFrom<typeof child>>(ref);
              expectType<ActorFromLogic<typeof child>>(ref);
              return { context: { ref } };
            },
            STOP: ({ context }, enq) => {
              enq.stop(context.ref);
              enq.sendTo(context.ref, { type: 'PING', x: 1 });
              if (context.ref) {
                enq.listen(
                  context.ref,
                  'someEvent',
                  (ev: { type: string }) => ({
                    type: 'PING' as const,
                    x: 0
                  })
                );
                enq.subscribeTo(context.ref, (snapshot) => {
                  expectType<{ n: number }>(snapshot.context);
                  return { type: 'PING' as const, x: snapshot.context.n };
                });
              }
            }
          }
        }
      }
    });
  });
});
