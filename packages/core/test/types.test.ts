import { from } from 'rxjs';
import { log } from '../src/actions/log';
import { raise } from '../src/actions/raise';
import { stop } from '../src/actions/stop';
import { fromPromise } from '../src/actors';
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
                guard: ({ context, event }) => {
                  return event.duration === 0 && context.elapsed > 0;
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
  it('should accept a valid event type', () => {
    interface Context {}

    type Events = { type: 'FOO' } | { type: 'BAR' };

    createMachine<Context, Events>({
      entry: raise({
        type: 'FOO'
      })
    });
  });

  it('should reject an invalid event type', () => {
    interface Context {}

    type Events = { type: 'FOO' } | { type: 'BAR' };

    createMachine<Context, Events>({
      entry: raise({
        // @ts-expect-error
        type: 'UNKNOWN'
      })
    });
  });

  it('should provide a narrowed down expression event type when used as a transition action', () => {
    interface Context {}

    type Events = { type: 'FOO' } | { type: 'BAR' };

    createMachine<Context, Events>({
      types: {
        context: {} as { counter: number },
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      on: {
        FOO: {
          actions: raise(({ event }) => {
            ((_arg: 'FOO') => {})(event.type);
            // @ts-expect-error
            ((_arg: 'BAR') => {})(event.type);

            return {
              type: 'BAR'
            };
          })
        }
      }
    });
  });

  it('should accept a valid event type returned from an expression', () => {
    interface Context {}

    type Events = { type: 'FOO' } | { type: 'BAR' };

    createMachine<Context, Events>({
      types: {
        context: {} as { counter: number },
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      entry: raise(() => ({
        type: 'BAR'
      }))
    });
  });

  it('should reject an invalid event type returned from an expression', () => {
    interface Context {}

    type Events = { type: 'FOO' } | { type: 'BAR' };

    createMachine<Context, Events>({
      types: {
        context: {} as { counter: number },
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      // @ts-expect-error
      entry: raise(() => ({
        type: 'UNKNOWN'
      }))
    });
  });
});

describe('log', () => {
  it('should narrow down the event type in the expression', () => {
    createMachine({
      types: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      on: {
        FOO: {
          actions: log(({ event }) => {
            ((_arg: 'FOO') => {})(event.type);
            // @ts-expect-error
            ((_arg: 'BAR') => {})(event.type);
          })
        }
      }
    });
  });
});

describe('stop', () => {
  it('should narrow down the event type in the expression', () => {
    createMachine({
      types: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      on: {
        FOO: {
          actions: stop(({ event }) => {
            ((_arg: 'FOO') => {})(event.type);
            // @ts-expect-error
            ((_arg: 'BAR') => {})(event.type);

            return 'fakeId';
          })
        }
      }
    });
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
          someAction: ({ context }) => {
            ((_accept: string) => {})(context.foo);
            // @ts-expect-error
            ((_accept: number) => {})(context.foo);
          }
        }
      }
    );
  });

  it('should not use actions as possible inference sites', () => {
    createMachine(
      {
        types: {
          context: {} as {
            count: number;
          }
        },
        entry: () => {}
      },
      {
        actions: {
          someAction: ({ context }) => {
            ((_accept: number) => {})(context.count);
            // @ts-expect-error
            ((_accept: string) => {})(context.count);
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
      types: {
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
      types: {
        events: {} as {
          type: 'FOO';
        }
      },
      entry: raise<any, any, any>({ type: 'FOO' })
    });

    const service = interpret(machine).start();

    service.send({ type: 'FOO' });
    // @ts-expect-error
    service.send({ type: 'UNKNOWN' });
  });

  it('should not use actions as possible inference sites 2', () => {
    const machine = createMachine({
      types: {
        events: {} as {
          type: 'FOO';
        }
      },
      entry: () => {}
    });

    const service = interpret(machine).start();

    service.send({ type: 'FOO' });
    // @ts-expect-error
    service.send({ type: 'UNKNOWN' });
  });

  it('event type should be inferrable from a simple state machine type', () => {
    const toggleMachine = createMachine<
      {
        count: number;
      },
      {
        type: 'TOGGLE';
      }
    >({});

    function acceptMachine<
      TContext extends {},
      TEvent extends { type: string }
    >(_machine: StateMachine<TContext, any, TEvent>) {}

    acceptMachine(toggleMachine);
  });

  it('should infer inline function parameters when narrowing transition actions based on the event type', () => {
    createMachine({
      types: {
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
          actions: ({ event }) => {
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
      types: {
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
          actions: ({ event }) => {
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
        types: {
          context: {} as { numbers: number[] },
          events: {} as { type: 'ADD'; number: number }
        }
      },
      {
        actions: {
          addNumber: assign({
            numbers: ({ context, event }) => {
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
      types: {
        context: {} as {
          count: number;
        }
      },
      on: {
        FOO: {
          actions: ({ event }) => {
            ((_accept: string) => {})(event.type);
          }
        }
      }
    });
  });
});

describe('interpreter', () => {
  it('should be convertable to Rx observable', () => {
    const s = interpret(
      createMachine({
        types: {
          context: {} as { count: number }
        }
      })
    );
    const state$ = from(s);

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
      spawnChild: (spawn: Spawner) => spawn(createChild())
    });
  });
});

describe('service-targets', () => {
  it('should work with a service that uses strings for both targets', () => {
    const machine = createMachine({
      invoke: {
        src: fromPromise(() => new Promise((resolve) => resolve(1))),
        onDone: ['.a', '.b']
      },
      initial: 'a',
      states: {
        a: {},
        b: {}
      }
    });
    noop(machine);
    expect(true).toBeTruthy();
  });

  it('should work with a service that uses TransitionConfigs for both targets', () => {
    const machine = createMachine({
      invoke: {
        src: fromPromise(() => new Promise((resolve) => resolve(1))),
        onDone: [{ target: '.a' }, { target: '.b' }]
      },
      initial: 'a',
      states: {
        a: {},
        b: {}
      }
    });
    noop(machine);
    expect(true).toBeTruthy();
  });

  it('should work with a service that uses a string for one target and a TransitionConfig for another', () => {
    const machine = createMachine({
      invoke: {
        src: fromPromise(() => new Promise((resolve) => resolve(1))),
        onDone: [{ target: '.a' }, '.b']
      },
      initial: 'a',
      states: {
        a: {},
        b: {}
      }
    });
    noop(machine);
    expect(true).toBeTruthy();
  });
});

describe('actions', () => {
  it('context should get inferred for builtin actions used as an entry action', () => {
    createMachine({
      types: {
        context: {} as { count: number }
      },
      context: {
        count: 0
      },
      entry: assign(({ context }) => {
        ((_accept: number) => {})(context.count);
        // @ts-expect-error
        ((_accept: "ain't any") => {})(context.count);
        return {};
      })
    });
  });

  it('context should get inferred for builtin actions used as a transition action', () => {
    createMachine({
      types: {
        context: {} as { count: number },
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      context: {
        count: 0
      },
      on: {
        FOO: {
          actions: assign(({ context }) => {
            ((_accept: number) => {})(context.count);
            // @ts-expect-error
            ((_accept: "ain't any") => {})(context.count);
            return {};
          })
        }
      }
    });
  });

  it('context should get inferred for a builtin action within an array of entry actions', () => {
    createMachine({
      types: {
        context: {} as { count: number }
      },
      entry: [
        'foo',
        assign(({ context }) => {
          ((_accept: number) => {})(context.count);
          // @ts-expect-error
          ((_accept: "ain't any") => {})(context.count);
          return {};
        })
      ]
    });
  });

  it('context should get inferred for a builtin action within an array of transition actions', () => {
    createMachine({
      types: {
        context: {} as { count: number }
      },
      on: {
        FOO: {
          actions: [
            'foo',
            assign(({ context }) => {
              ((_accept: number) => {})(context.count);
              // @ts-expect-error
              ((_accept: "ain't any") => {})(context.count);
              return {};
            })
          ]
        }
      }
    });
  });

  it('context should get inferred for a stop action used as an entry action', () => {
    const childMachine = createMachine({
      initial: 'idle',
      states: {
        idle: {}
      }
    });

    createMachine({
      types: {
        context: {} as {
          count: number;
          childRef: ActorRefFrom<typeof childMachine>;
        }
      },
      entry: stop(({ context }) => {
        ((_accept: number) => {})(context.count);
        // @ts-expect-error
        ((_accept: "ain't any") => {})(context.count);
        return context.childRef;
      })
    });
  });

  it('context should get inferred for a stop action used as a transition action', () => {
    const childMachine = createMachine({
      initial: 'idle',
      states: {
        idle: {}
      }
    });

    createMachine({
      types: {
        context: {} as {
          count: number;
          childRef: ActorRefFrom<typeof childMachine>;
        }
      },
      on: {
        FOO: {
          actions: stop(({ context }) => {
            ((_accept: number) => {})(context.count);
            // @ts-expect-error
            ((_accept: "ain't any") => {})(context.count);
            return context.childRef;
          })
        }
      }
    });
  });

  it('should report an error when the stop action returns an invalid actor ref', () => {
    createMachine({
      types: {
        context: {} as {
          count: number;
        }
      },
      entry: stop(
        // @ts-expect-error
        ({ context }) => {
          return context.count;
        }
      )
    });
  });

  it('context should get inferred for a stop actions within an array of entry actions', () => {
    const childMachine = createMachine({});

    createMachine({
      types: {
        context: {} as {
          count: number;
          childRef: ActorRefFrom<typeof childMachine>;
          promiseRef: ActorRefFrom<Promise<string>>;
        }
      },
      entry: [
        stop(({ context }) => {
          ((_accept: number) => {})(context.count);
          // @ts-expect-error
          ((_accept: "ain't any") => {})(context.count);
          return context.childRef;
        }),
        stop(({ context }) => {
          ((_accept: number) => {})(context.count);
          // @ts-expect-error
          ((_accept: "ain't any") => {})(context.count);
          return context.promiseRef;
        })
      ]
    });
  });

  it('should accept assign with partial static object', () => {
    createMachine({
      types: {
        events: {} as {
          type: 'TOGGLE';
        },
        context: {} as {
          count: number;
          mode: 'foo' | 'bar' | null;
        }
      },
      context: {
        count: 0,
        mode: null
      },
      entry: assign({ mode: 'foo' })
    });
  });

  it("should provide context to single prop updater in assign when it's mixed with a static value for another prop", () => {
    createMachine({
      types: {
        context: {} as {
          count: number;
          skip: boolean;
        },
        events: {} as {
          type: 'TOGGLE';
        }
      },
      context: {
        count: 0,
        skip: true
      },
      entry: assign({
        count: ({ context }) => context.count + 1,
        skip: true
      })
    });
  });
});
