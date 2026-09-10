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
        // plain predicates: params only, no injected transition args
        isPositive: (count: number) => count > 0,
        isAbove: (count: number, threshold: number) => count > threshold
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

  it('accepts plain positional guards', () => {
    setup({
      schemas: {
        context: z.object({ count: z.number() })
      },
      guards: {
        positional: (count: number) => count > 0
      }
    });
  });

  it('accepts loosely-typed guards and delays without schemas', () => {
    setup({
      guards: {
        anyValue: (value) => value === true
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
        isPositive: (count: number) => count > 0
      },
      delays: {
        backoff: ({ context }) => {
          expectType<{ count: number }>(context);
          return context.count * 100;
        }
      }
    });
  });

  it('merges base and extension event schemas for extend() sources', () => {
    setup({
      schemas: {
        context: z.object({ count: z.number() }),
        events: { A: z.object({ a: z.number() }) }
      }
    }).extend({
      schemas: {
        events: { B: z.object({ b: z.string() }) }
      },
      delays: {
        seesBothEvents: ({ event }) => {
          expectType<{ type: 'A'; a: number } | { type: 'B'; b: string }>(
            event
          );
          return event.type === 'A' ? 100 : 200;
        }
      }
    });
  });

  it('checks return types of sources passed to provide()', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({ count: z.number() })
      },
      context: { count: 0 },
      guards: {
        isPositive: (count: number) => count > 0
      },
      delays: {
        backoff: ({ context }) => context.count * 100
      },
      initial: 'a',
      states: { a: {} }
    });

    machine.provide({
      guards: {
        isPositive: (count: number) => count > 1
      },
      delays: {
        backoff: 500
      }
    });

    if (false) {
      machine.provide({
        guards: {
          // @ts-expect-error - guards must return boolean
          isPositive: () => 'nope'
        }
      });
      machine.provide({
        delays: {
          // @ts-expect-error - delays must be a number or return one
          backoff: () => 'soon'
        }
      });
      machine.provide({
        guards: {
          // @ts-expect-error - unknown guard name
          other: () => true
        }
      });
    }
  });

  it('allows provide() to swap a fixed delay for a computed one and back', () => {
    const machine = setup({
      schemas: {
        context: z.object({ ms: z.number() })
      },
      delays: {
        retry: 1_000,
        backoff: ({ context }) => context.ms
      }
    }).createMachine({
      context: { ms: 100 },
      initial: 'a',
      states: { a: {} }
    });

    machine.provide({
      delays: {
        retry: ({ context }) => {
          expectType<{ ms: number }>(context);
          return context.ms * 2;
        },
        backoff: 250
      }
    });

    if (false) {
      machine.provide({
        delays: {
          // @ts-expect-error - unknown delay name
          unknown: 100
        }
      });
    }
  });

  it('contextually types machine-level guards from machine schemas', () => {
    createMachine({
      schemas: {
        context: z.object({ ok: z.boolean() })
      },
      context: { ok: true },
      guards: {
        isOk: (ok: boolean) => ok
      },
      initial: 'a',
      states: { a: {} }
    });
  });

  it('surfaces guards on args with their declared plain signatures', () => {
    createMachine({
      schemas: {
        context: z.object({ count: z.number() })
      },
      context: { count: 0 },
      guards: {
        isAbove: (count: number, threshold: number) => count > threshold,
        isEnabled: () => true
      },
      initial: 'a',
      states: {
        a: {
          on: {
            EV: (args) => {
              // params keep their declared types
              ((_accept: boolean) => {})(
                args.guards.isAbove(args.context.count, 3)
              );
              // @ts-expect-error guard params must match the declared types
              args.guards.isAbove('1', 3);
              // @ts-expect-error no transition args object is expected
              args.guards.isAbove(args, 3);
              ((_accept: boolean) => {})(args.guards.isEnabled());
              if (args.guards.isAbove(args.context.count, 3)) {
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
