import { z } from 'zod';
import {
  createActor,
  createAsyncLogic,
  createMachine,
  setup,
  type ActorRefFrom,
  type ActorFromLogic
} from '../src/index.ts';

function expectType<T>(_v: T) {}

describe('setup() source typing', () => {
  it('requires machine-level source overrides to satisfy setup contracts', () => {
    const load = createAsyncLogic({
      schemas: { input: z.string(), output: z.number() },
      run: async ({ input }) => input.length
    });
    const otherLoad = createAsyncLogic({
      schemas: { input: z.number(), output: z.string() },
      run: async ({ input }) => String(input)
    });
    const base = setup({
      actions: { record: (id: string) => ({ context: { id } }) },
      actors: { load },
      guards: { enabled: (id: string) => id.length > 0 }
    });

    base.createMachine({
      actions: {
        record: (id: string) => ({ context: { id } }),
        reset: () => {}
      },
      actors: { load, otherLoad },
      guards: { enabled: (id: string) => id === 'ready' },
      on: {
        RESET: ({ actions }, enq) => {
          enq(actions.reset);
          expectType<{ context: { id: string } }>(actions.record('ready'));
        }
      }
    });

    if (false) {
      base.createMachine({
        actions: {
          // @ts-expect-error the replacement must accept the declared argument
          record: (id: number) => ({ context: { id: String(id) } })
        }
      });
      base.createMachine({
        actions: {
          // @ts-expect-error the replacement must return a compatible result
          record: () => {}
        }
      });
      base.createMachine({
        actors: {
          // @ts-expect-error the replacement must keep the actor's input and output contract
          load: otherLoad
        }
      });
      base.createMachine({
        guards: {
          // @ts-expect-error the replacement must accept the declared argument
          enabled: (id: number) => id > 0
        }
      });
    }
  });

  it('checks schema-only source contracts on createMachine and extend', () => {
    const base = setup({
      schemas: {
        actions: { record: { params: z.string() } },
        guards: { enabled: { params: z.string() } }
      }
    });

    const sources = {
      actions: { record: (id: string) => ({ id }) },
      guards: { enabled: (id: string) => id.length > 0 }
    };
    base.createMachine(sources);
    base.extend(sources);

    if (false) {
      base.createMachine({
        actions: {
          // @ts-expect-error the action must accept the schema's params
          record: (_id: number) => {}
        },
        guards: {
          // @ts-expect-error the guard must accept the schema's params
          enabled: (id: number) => id > 0
        }
      });
      base.extend({
        actions: {
          // @ts-expect-error the action must accept the inherited schema's params
          record: (_id: number) => {}
        }
      });
    }
  });

  it('checks dictionary values against every source they could replace', () => {
    const load = createAsyncLogic({
      schemas: { input: z.string(), output: z.number() },
      run: async ({ input }) => input.length
    });
    const base = setup({
      actions: { record: (id: string) => ({ context: { id } }) },
      actors: { load },
      guards: { enabled: (id: string) => id.length > 0 }
    });

    const actions: Record<string, (id: string) => { context: { id: string } }> =
      { record: (id) => ({ context: { id } }) };
    const guards: Record<string, (id: string) => boolean> = {
      enabled: (id) => id.length > 0
    };
    const actors: Record<string, typeof load> = { load };
    base.createMachine({ actions, guards, actors });
    base.extend({ actions, guards, actors });

    if (false) {
      const numberActions: Record<string, (id: number) => void> = {};
      const numberGuards: Record<string, (id: number) => boolean> = {};
      const otherLoad = createAsyncLogic({
        schemas: { input: z.number(), output: z.string() },
        run: async ({ input }) => String(input)
      });
      const numberActors: Record<string, typeof otherLoad> = {};
      base.createMachine({
        // @ts-expect-error a dictionary action may replace record
        actions: numberActions,
        // @ts-expect-error a dictionary guard may replace enabled
        guards: numberGuards,
        // @ts-expect-error a dictionary actor may replace load
        actors: numberActors
      });

      const matching: Record<`re${string}`, (id: number) => void> = {};
      const unrelated: Record<`extra-${string}`, (id: number) => void> = {};
      base.createMachine({
        // @ts-expect-error the index pattern includes record
        actions: matching
      });
      base.createMachine({ actions: unrelated });
    }
  });

  it('checks string and numeric aliases for source names', () => {
    const load = createAsyncLogic({
      schemas: { input: z.string() },
      run: async ({ input }) => input.length
    });
    const base = setup({
      actions: { 0: (_id: string) => {} },
      actors: { 0: load },
      guards: { 0: (id: string) => id.length > 0 }
    });
    const actions: Record<string, (id: string) => void> = { '0': () => {} };
    const guards: Record<string, (id: string) => boolean> = { '0': () => true };
    const actors: Record<string, typeof load> = { '0': load };
    base.createMachine({ actions, guards, actors });

    base.createMachine({
      actions: { '0': (_id: string) => {}, newAction: () => {} },
      actors: { '0': load },
      guards: { '0': (id: string) => id.length > 0 }
    });

    if (false) {
      const numberActions: Record<string, (id: number) => void> = {};
      const numberGuards: Record<string, (id: number) => boolean> = {};
      const otherLoad = createAsyncLogic({
        schemas: { input: z.number() },
        run: async ({ input }) => input
      });
      const numberActors: Record<string, typeof otherLoad> = {};
      base.createMachine({
        // @ts-expect-error the dictionary can replace the action at 0
        actions: numberActions,
        // @ts-expect-error the dictionary can replace the guard at 0
        guards: numberGuards,
        // @ts-expect-error the dictionary can replace the actor at 0
        actors: numberActors
      });
      base.createMachine({
        actions: {
          // @ts-expect-error the string alias replaces the numeric action
          '0': (_id: number) => {}
        },
        actors: {
          // @ts-expect-error the string alias replaces the numeric actor
          '0': otherLoad
        },
        guards: {
          // @ts-expect-error the string alias replaces the numeric guard
          '0': (id: number) => id > 0
        }
      });
      const numericActions: Record<number, (id: number) => void> = {};
      base.createMachine({
        // @ts-expect-error a numeric index can also replace the action at 0
        actions: numericActions
      });

      setup({ actions: { '0': (_id: string) => {} } }).createMachine({
        actions: {
          // @ts-expect-error the numeric alias replaces the string action
          0: (_id: number) => {}
        }
      });
    }
  });

  it('checks each possible action and guard map in a union of overrides', () => {
    const base = setup({
      actions: { record: (_id: string) => {} },
      guards: { enabled: (id: string) => id.length > 0 }
    });

    function createWithOverrides(
      actions: { record: (id: string) => void } | { extra: () => void },
      guards: { enabled: (id: string) => boolean } | { extra: () => boolean }
    ) {
      return base.createMachine({ actions, guards });
    }
    createWithOverrides({ extra: () => {} }, { extra: () => true });

    function checkWrongOverrides(
      actions: { record: (id: number) => void } | { extra: () => void },
      guards:
        | { extra: () => boolean; enabled: (id: number) => boolean }
        | { extra: () => boolean }
    ) {
      base.createMachine({
        // @ts-expect-error one possible action map has incompatible params
        actions,
        // @ts-expect-error one possible guard map has incompatible params
        guards
      });
    }
    void checkWrongOverrides;
  });

  it('rejects unknown action and guard names in transition functions', () => {
    setup({
      actions: { record: (_id: string) => {} },
      guards: { enabled: () => true }
    }).createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            GO: ({ actions, guards }) => {
              actions.record('id');
              guards.enabled();
              // @ts-expect-error unknown action
              actions.reccord('id');
              // @ts-expect-error unknown guard
              guards.enabld();
            }
          }
        }
      }
    });
    createMachine({
      actions: { record: (_id: string) => {} },
      guards: { enabled: () => true },
      on: {
        GO: ({ actions, guards }) => {
          actions.record('id');
          guards.enabled();
          // @ts-expect-error unknown action
          actions.reccord('id');
          // @ts-expect-error unknown guard
          guards.enabld();
        }
      }
    });
  });

  it('preserves provided action result types and checks their arguments and names', () => {
    const machine = setup({
      actions: { record: (_id: string) => {} }
    }).createMachine({});
    const provided = machine.provide({ actions: { record: (id) => ({ id }) } });
    if (false)
      expectType<{ id: string }>(provided._actionMap.record('release'));
    const replaced = provided.provide({ actions: { record: (_id) => 42 } });
    if (false) expectType<number>(replaced._actionMap.record('release'));
    if (false) {
      machine.provide({
        actions: {
          // @ts-expect-error -- action arguments must match the declared source
          record: (_id: number) => {}
        }
      });
      machine.provide({
        actions: {
          // @ts-expect-error -- only declared source names can be provided
          unknown: () => {}
        }
      });
    }
  });

  it('checks the result of a provided action against the declared result', () => {
    type Currency = 'EUR' | 'USD';
    const form = setup({
      schemas: {
        context: z.object({ currency: z.enum(['EUR', 'USD']) }),
        events: { pick: z.object({ country: z.string() }) }
      },
      actions: {
        applyDefaults: (country: string) => ({
          context: { currency: (country === 'FR' ? 'EUR' : 'USD') as Currency }
        })
      }
    });
    const machine = form.createMachine({
      context: { currency: 'USD' },
      on: { pick: ({ actions, event }) => actions.applyDefaults(event.country) }
    });

    const euro = machine.provide({
      actions: { applyDefaults: () => ({ context: { currency: 'EUR' } }) }
    });
    const actor = createActor(euro).start();
    actor.send({ type: 'pick', country: 'US' });
    expect(actor.getSnapshot().context).toEqual({ currency: 'EUR' });

    if (false) {
      machine.provide({
        actions: {
          // @ts-expect-error -- the declared result is a context patch
          applyDefaults: () => ({ context: { currency: 'EURO' } })
        }
      });
      machine.provide({
        actions: {
          // @ts-expect-error -- the declared patch requires the currency key
          applyDefaults: () => ({ context: { curency: 'EUR' } })
        }
      });
      machine.provide({
        actions: {
          // @ts-expect-error -- the declared result is a context patch
          applyDefaults: () => 42
        }
      });
      machine.provide({
        actions: {
          // @ts-expect-error -- the declared result is a context patch
          applyDefaults: () => {}
        }
      });
      // A replacement is checked against the declared action, not against the
      // previous replacement.
      euro.provide({
        actions: { applyDefaults: () => ({ context: { currency: 'USD' } }) }
      });
      const optional: {
        applyDefaults?: () => { context: { currency: 'EUR' } };
      } = {};
      const maybeEuro = machine.provide({ actions: optional });
      expectType<Currency>(
        maybeEuro._actionMap.applyDefaults('US').context.currency
      );
      maybeEuro.provide({
        actions: { applyDefaults: () => ({ context: { currency: 'USD' } }) }
      });
      maybeEuro.provide({
        actions: {
          // @ts-expect-error -- optional overrides retain the declared result
          applyDefaults: () => {}
        }
      });
      euro.provide({
        actions: {
          // @ts-expect-error -- the declared result is a context patch
          applyDefaults: () => {}
        }
      });
      // `extend()` checks an action that reuses a base name the same way.
      form.extend({
        actions: {
          // @ts-expect-error -- the declared result is a context patch
          applyDefaults: () => {}
        }
      });
      // An action only declared in `schemas.actions` is an effect, so its
      // implementation may return any value.
      setup({
        schemas: {
          actions: { track: { params: z.object({ key: z.string() }) } }
        }
      })
        .createMachine({})
        .provide({ actions: { track: async () => {} } });
    }
  });

  it('preserves explicit undefined and never action result contracts', () => {
    const machine = setup({
      actions: {
        empty: (): undefined => undefined,
        fail: (): never => {
          throw new Error('failed');
        }
      }
    }).createMachine({});
    if (false) {
      machine.provide({
        actions: {
          empty: () => undefined,
          fail: () => {
            throw new Error('replacement failed');
          }
        }
      });
      machine.provide({
        actions: {
          // @ts-expect-error -- undefined is an explicit result contract
          empty: () => 42
        }
      });
      machine.provide({
        actions: {
          // @ts-expect-error -- a never action cannot return normally
          fail: () => {}
        }
      });
    }
  });

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
