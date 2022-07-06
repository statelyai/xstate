import { from } from 'rxjs';
import { raise } from '../src/actions/raise';
import { fromMachine } from '../src/actors';
import {
  ActorRefFrom,
  assign,
  createMachine,
  interpret,
  MachineContext,
  Spawner,
  StateMachine
} from '../src/index';

function noop(_x: unknown) {
  return;
}

describe('StateSchema', () => {
  type LightEvent =
    | { type: 'TIMER' }
    | { type: 'POWER_OUTAGE' }
    | { type: 'PED_COUNTDOWN'; duration: number };

  interface LightContext {
    elapsed: number;
  }

  const lightMachine = createMachine<LightContext, LightEvent>({
    key: 'light',
    initial: 'green',
    meta: { interval: 1000 },
    context: { elapsed: 0 },
    states: {
      green: {
        id: 'green',
        meta: { name: 'greenLight' },
        on: {
          TIMER: 'yellow',
          POWER_OUTAGE: 'red'
        }
      },
      yellow: {
        on: {
          TIMER: 'red',
          POWER_OUTAGE: 'red'
        }
      },
      red: {
        on: {
          TIMER: 'green',
          POWER_OUTAGE: 'red'
        },
        initial: 'walk',
        states: {
          walk: {
            on: {
              PED_COUNTDOWN: 'wait'
            }
          },
          wait: {
            on: {
              PED_COUNTDOWN: {
                target: 'stop',
                guard: (
                  ctx,
                  e: { type: 'PED_COUNTDOWN'; duration: number }
                ) => {
                  return e.duration === 0 && ctx.elapsed > 0;
                }
              }
            }
          },
          stop: {
            always: { target: '#green' }
          }
        }
      }
    }
  });

  noop(lightMachine);

  it('should work with a StateSchema defined', () => {
    expect(true).toBeTruthy();
  });
});

describe('Parallel StateSchema', () => {
  type ParallelEvent =
    | { type: 'TIMER' }
    | { type: 'POWER_OUTAGE' }
    | { type: 'E' }
    | { type: 'PED_COUNTDOWN'; duration: number };

  interface ParallelContext {
    elapsed: number;
  }

  const parallelMachine = createMachine<ParallelContext, ParallelEvent>({
    type: 'parallel',
    states: {
      foo: {},
      bar: {},
      baz: {
        initial: 'one',
        states: {
          one: { on: { E: 'two' } },
          two: {}
        }
      }
    }
  });

  noop(parallelMachine);

  it('should work with a parallel StateSchema defined', () => {
    expect(true).toBeTruthy();
  });
});

describe('Nested parallel stateSchema', () => {
  interface ParallelEvent {
    type: 'UPDATE.CONTEXT';
  }

  interface ParallelContext {
    lastDate: Date;
  }

  const nestedParallelMachine = createMachine<ParallelContext, ParallelEvent>({
    initial: 'foo',
    states: {
      foo: {},
      bar: {},
      baz: {
        type: 'parallel',
        initial: 'blockUpdates',
        states: {
          blockUpdates: { type: 'final' },
          activeParallelNode: {
            on: {
              'UPDATE.CONTEXT': {
                actions: [
                  assign({
                    lastDate: new Date()
                  })
                ]
              }
            }
          }
        }
      }
    }
  });

  noop(nestedParallelMachine);

  it('should work with a parallel StateSchema defined', () => {
    expect(true).toBeTruthy();
  });
});

describe('Raise events', () => {
  it('should work with all the ways to raise events', () => {
    type GreetingEvent =
      | { type: 'DECIDE'; aloha?: boolean }
      | { type: 'MORNING' }
      | { type: 'LUNCH_TIME' }
      | { type: 'AFTERNOON' }
      | { type: 'EVENING' }
      | { type: 'NIGHT' }
      | { type: 'ALOHA' };

    interface GreetingContext {
      hour: number;
    }

    const greetingContext: GreetingContext = { hour: 10 };

    const raiseGreetingMachine = createMachine<GreetingContext, GreetingEvent>({
      key: 'greeting',
      context: greetingContext,
      initial: 'pending',
      states: {
        pending: {
          on: {
            DECIDE: [
              {
                actions: raise({
                  type: 'ALOHA'
                }),
                guard: (_ctx, ev) => !!ev.aloha
              },
              {
                actions: raise({
                  type: 'MORNING'
                }),
                guard: (ctx) => ctx.hour < 12
              },
              {
                actions: raise({
                  type: 'AFTERNOON'
                }),
                guard: (ctx) => ctx.hour < 18
              },
              {
                actions: raise({ type: 'EVENING' }),
                guard: (ctx) => ctx.hour < 22
              }
            ]
          }
        },
        morning: {},
        lunchTime: {},
        afternoon: {},
        evening: {},
        night: {}
      },
      on: {
        MORNING: '.morning',
        LUNCH_TIME: '.lunchTime',
        AFTERNOON: '.afternoon',
        EVENING: '.evening',
        NIGHT: '.night'
      }
    });

    noop(raiseGreetingMachine);
    expect(true).toBeTruthy();
  });
});

describe('types', () => {
  it('defined context in createMachine() should be an object', () => {
    createMachine({
      // @ts-expect-error
      context: 'string'
    });
  });
});

describe('context', () => {
  it('should infer context type from `config.context` when there is no `schema.context`', () => {
    createMachine(
      {
        context: {
          foo: 'test'
        }
      },
      {
        actions: {
          someAction: (ctx) => {
            ((_accept: string) => {})(ctx.foo);
            // @ts-expect-error
            ((_accept: number) => {})(ctx.foo);
          }
        }
      }
    );
  });

  it('should not use actions as possible inference sites', () => {
    createMachine(
      {
        schema: {
          context: {} as {
            count: number;
          }
        },
        entry: (_ctx: any) => {}
      },
      {
        actions: {
          someAction: (ctx) => {
            ((_accept: number) => {})(ctx.count);
            // @ts-expect-error
            ((_accept: string) => {})(ctx.count);
          }
        }
      }
    );
  });

  it('should work with generic context', () => {
    function createMachineWithExtras<TContext extends MachineContext>(
      context: TContext
    ): StateMachine<TContext, any, any> {
      return createMachine({ context });
    }

    createMachineWithExtras({ counter: 42 });
  });

  it('should not widen literal types defined in `schema.context` based on `config.context`', () => {
    createMachine({
      schema: {
        context: {} as {
          literalTest: 'foo' | 'bar';
        }
      },
      context: {
        // @ts-expect-error
        literalTest: 'anything'
      }
    });
  });
});

describe('events', () => {
  it('should not use actions as possible inference sites 1', () => {
    const machine = createMachine({
      schema: {
        events: {} as {
          type: 'FOO';
        }
      },
      entry: raise('FOO')
    });

    const service = interpret(machine).start();

    service.send({ type: 'FOO' });
    // @ts-expect-error
    service.send({ type: 'UNKNOWN' });
  });

  it('should not use actions as possible inference sites 2', () => {
    const machine = createMachine({
      schema: {
        events: {} as {
          type: 'FOO';
        }
      },
      entry: (_ctx, _ev: any) => {}
    });

    const service = interpret(machine).start();

    service.send({ type: 'FOO' });
    // @ts-expect-error
    service.send({ type: 'UNKNOWN' });
  });

  it('event type should be inferrable from a simple state machine typr', () => {
    const toggleMachine = createMachine<
      {
        count: number;
      },
      {
        type: 'TOGGLE';
      }
    >({});

    function acceptMachine<TContext, TEvent extends { type: string }>(
      _machine: StateMachine<TContext, any, TEvent>
    ) {}

    acceptMachine(toggleMachine);
  });

  it('should infer inline function parameters when narrowing transition actions based on the event type', () => {
    createMachine({
      schema: {
        context: {} as {
          count: number;
        },
        events: {} as
          | { type: 'EVENT_WITH_FLAG'; flag: boolean }
          | {
              type: 'EVENT_WITHOUT_FLAG';
            }
      },
      on: {
        EVENT_WITH_FLAG: {
          actions: (_context, event) => {
            ((_accept: 'EVENT_WITH_FLAG') => {})(event.type);
            ((_accept: boolean) => {})(event.flag);
            // @ts-expect-error
            ((_accept: 'is not any') => {})(event);
          }
        }
      }
    });
  });

  it('should infer inline function parameters when for a wildcard transition', () => {
    createMachine({
      schema: {
        context: {} as {
          count: number;
        },
        events: {} as
          | { type: 'EVENT_WITH_FLAG'; flag: boolean }
          | {
              type: 'EVENT_WITHOUT_FLAG';
            }
      },
      on: {
        '*': {
          actions: (_context, event) => {
            ((_accept: 'EVENT_WITH_FLAG' | 'EVENT_WITHOUT_FLAG') => {})(
              event.type
            );
            // @ts-expect-error
            ((_accept: 'is not any') => {})(event);
          }
        }
      }
    });
  });

  it('action objects used within implementations parameter should get access to the provided event type', () => {
    createMachine(
      {
        schema: {
          context: {} as { numbers: number[] },
          events: {} as { type: 'ADD'; number: number }
        }
      },
      {
        actions: {
          addNumber: assign({
            numbers: (context, event) => {
              ((_accept: number) => {})(event.number);
              // @ts-expect-error
              ((_accept: string) => {})(event.number);
              return context.numbers.concat(event.number);
            }
          })
        }
      }
    );
  });

  it('should provide the default TEvent to transition actions when there is no specific TEvent configured', () => {
    createMachine({
      schema: {
        context: {} as {
          count: number;
        }
      },
      on: {
        FOO: {
          actions: (_context, event) => {
            ((_accept: string) => {})(event.type);
          }
        }
      }
    });
  });
});

describe('interpreter', () => {
  it('should be convertable to Rx observable', () => {
    const state$ = from(
      interpret(
        createMachine({
          schema: {
            context: {} as { count: number }
          }
        })
      )
    );

    state$.subscribe((state) => {
      ((_val: number) => {})(state.context.count);
      // @ts-expect-error
      ((_val: string) => {})(state.context.count);
    });
  });
});

describe('spawn', () => {
  it('spawned actor ref should be compatible with the result of ActorRefFrom', () => {
    const createChild = () => createMachine({});

    function createParent(_deps: {
      spawnChild: (spawn: Spawner) => ActorRefFrom<typeof createChild>;
    }) {}

    createParent({
      spawnChild: (spawn: Spawner) => spawn(fromMachine(createChild()))
    });
  });
});
