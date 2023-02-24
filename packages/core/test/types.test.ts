import { from } from 'rxjs';
import {
  Machine,
  assign,
  createMachine,
  interpret,
  StateMachine,
  spawn,
  ActorRefFrom
} from '../src/index';
import { raise, stop, log } from '../src/actions';
import { createModel } from '../src/model';

function noop(_x: unknown) {
  return;
}

describe('StateSchema', () => {
  interface LightStateSchema {
    meta: {
      interval: number;
    };
    states: {
      green: {
        meta: { name: string };
      };
      yellow: {};
      red: {
        states: {
          walk: {};
          wait: {};
          stop: {};
        };
      };
    };
  }

  type LightEvent =
    | { type: 'TIMER' }
    | { type: 'POWER_OUTAGE' }
    | { type: 'PED_COUNTDOWN'; duration: number };

  interface LightContext {
    elapsed: number;
  }

  const lightMachine = Machine<LightContext, LightStateSchema, LightEvent>({
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
                cond: (ctx, e: { type: 'PED_COUNTDOWN'; duration: number }) => {
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
  interface ParallelStateSchema {
    states: {
      foo: {};
      bar: {};
      baz: {
        states: {
          one: {};
          two: {};
        };
      };
    };
  }

  type ParallelEvent =
    | { type: 'TIMER' }
    | { type: 'POWER_OUTAGE' }
    | { type: 'E' }
    | { type: 'PED_COUNTDOWN'; duration: number };

  interface ParallelContext {
    elapsed: number;
  }

  const parallelMachine = Machine<
    ParallelContext,
    ParallelStateSchema,
    ParallelEvent
  >({
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
  interface ParallelStateSchema {
    states: {
      foo: {};
      bar: {};
      baz: {
        states: {
          blockUpdates: {};
          activeParallelNode: {};
        };
      };
    };
  }

  interface ParallelEvent {
    type: 'UPDATE.CONTEXT';
  }

  interface ParallelContext {
    lastDate: Date;
  }

  const nestedParallelMachine = Machine<
    ParallelContext,
    ParallelStateSchema,
    ParallelEvent
  >({
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
  // TODO: will be removed in v5
  it('should accept a valid simple event type', () => {
    interface Context {}

    type Events = { type: 'FOO' } | { type: 'BAR' };

    createMachine<Context, Events>({
      entry: raise('FOO')
    });
  });

  // TODO: will be removed in v5
  it('should reject an invalid simple event type', () => {
    interface Context {}

    type Events = { type: 'FOO' } | { type: 'BAR' };

    createMachine<Context, Events>({
      // @ts-expect-error
      entry: raise('UNKNOWN')
    });
  });

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
      schema: {
        context: {} as { counter: number },
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      on: {
        FOO: {
          actions: raise((_ctx, ev) => {
            ((_arg: 'FOO') => {})(ev.type);
            // @ts-expect-error
            ((_arg: 'BAR') => {})(ev.type);

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
      schema: {
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
      schema: {
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
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      on: {
        FOO: {
          actions: log((_ctx, ev) => {
            ((_arg: 'FOO') => {})(ev.type);
            // @ts-expect-error
            ((_arg: 'BAR') => {})(ev.type);
          })
        }
      }
    });
  });
});

describe('stop', () => {
  it('should narrow down the event type in the expression', () => {
    createMachine({
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      on: {
        FOO: {
          actions: stop((_ctx, ev) => {
            ((_arg: 'FOO') => {})(ev.type);
            // @ts-expect-error
            ((_arg: 'BAR') => {})(ev.type);

            return 'fakeId';
          })
        }
      }
    });
  });
});

describe('Typestates', () => {
  // Using "none" because undefined and null are unavailable when not in strict mode.
  type None = { type: 'none' };
  const none: None = { type: 'none' };

  const taskMachineConfiguration = {
    id: 'task',
    initial: 'idle',
    context: {
      result: none as None | number,
      error: none as None | string
    },
    states: {
      idle: {
        on: { RUN: 'running' }
      },
      running: {
        invoke: {
          id: 'task-1',
          src: 'taskService',
          onDone: { target: 'succeeded', actions: 'assignSuccess' },
          onError: { target: 'failed', actions: 'assignFailure' }
        }
      },
      succeeded: {},
      failed: {}
    }
  };

  type TaskContext = typeof taskMachineConfiguration.context;

  type TaskTypestate =
    | { value: 'idle'; context: { result: None; error: None } }
    | { value: 'running'; context: { result: None; error: None } }
    | { value: 'succeeded'; context: { result: number; error: None } }
    | { value: 'failed'; context: { result: None; error: string } };

  type ExtractTypeState<T extends TaskTypestate['value']> = Extract<
    TaskTypestate,
    { value: T }
  >['context'];
  type Idle = ExtractTypeState<'idle'>;
  type Running = ExtractTypeState<'running'>;
  type Succeeded = ExtractTypeState<'succeeded'>;
  type Failed = ExtractTypeState<'failed'>;

  const machine = createMachine<TaskContext, any, TaskTypestate>(
    taskMachineConfiguration
  );

  it("should preserve typestate for the service returned by Interpreter.start() and a servcie's .state getter.", () => {
    const service = interpret(machine);
    const startedService = service.start();

    const idle: Idle = startedService.state.matches('idle')
      ? startedService.state.context
      : { result: none, error: none };
    expect(idle).toEqual({ result: none, error: none });

    const running: Running = startedService.state.matches('running')
      ? startedService.state.context
      : { result: none, error: none };
    expect(running).toEqual({ result: none, error: none });

    const succeeded: Succeeded = startedService.state.matches('succeeded')
      ? startedService.state.context
      : { result: 12, error: none };
    expect(succeeded).toEqual({ result: 12, error: none });

    const failed: Failed = startedService.state.matches('failed')
      ? startedService.state.context
      : { result: none, error: 'oops' };
    expect(failed).toEqual({ result: none, error: 'oops' });
  });

  it('should preserve typestate for state node returned by StateNode.withConfig.', () => {
    const machine2 = machine.withConfig({});
    const service = interpret(machine2);
    service.start();

    const idle: Idle = service.state.matches('idle')
      ? service.state.context
      : { result: none, error: none };
    expect(idle).toEqual({ result: none, error: none });

    const running: Running = service.state.matches('running')
      ? service.state.context
      : { result: none, error: none };
    expect(running).toEqual({ result: none, error: none });

    const succeeded: Succeeded = service.state.matches('succeeded')
      ? service.state.context
      : { result: 12, error: none };
    expect(succeeded).toEqual({ result: 12, error: none });

    const failed: Failed = service.state.matches('failed')
      ? service.state.context
      : { result: none, error: 'oops' };
    expect(failed).toEqual({ result: none, error: 'oops' });
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
    function createMachineWithExtras<TContext extends {}>(
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
      entry: raise<any, any, any>('FOO')
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

  it('event type should be inferrable from a simple state machine type', () => {
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

  it('action objects used within implementations parameter should get access to the provided event type when using model', () => {
    createModel(
      {
        numbers: [] as number[]
      },
      {
        events: {
          ADD: (number: number) => ({ number })
        }
      }
    ).createMachine(
      {},
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
      spawnChild: () => ActorRefFrom<typeof createChild>;
    }) {}

    createParent({
      spawnChild: () => spawn(createChild())
    });
  });
});

describe('service-targets', () => {
  it('should work with a service that uses strings for both targets', () => {
    const machine = createMachine({
      invoke: {
        src: () => new Promise((resolve) => resolve(1)),
        onDone: ['a', 'b']
      },
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
        src: () => new Promise((resolve) => resolve(1)),
        onDone: [{ target: 'a' }, { target: 'b' }]
      },
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
        src: () => new Promise((resolve) => resolve(1)),
        onDone: [{ target: 'a' }, 'b']
      },
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
      schema: {
        context: {} as { count: number }
      },
      context: {
        count: 0
      },
      entry: assign((ctx) => {
        ((_accept: number) => {})(ctx.count);
        // @ts-expect-error
        ((_accept: "ain't any") => {})(ctx.count);
        return {};
      })
    });
  });

  it('context should get inferred for builtin actions used as a transition action', () => {
    createMachine({
      schema: {
        context: {} as { count: number },
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      context: {
        count: 0
      },
      on: {
        FOO: {
          actions: assign((ctx) => {
            ((_accept: number) => {})(ctx.count);
            // @ts-expect-error
            ((_accept: "ain't any") => {})(ctx.count);
            return {};
          })
        }
      }
    });
  });

  it('context should get inferred for a builtin action within an array of entry actions', () => {
    createMachine({
      schema: {
        context: {} as { count: number }
      },
      entry: [
        'foo',
        assign((ctx) => {
          ((_accept: number) => {})(ctx.count);
          // @ts-expect-error
          ((_accept: "ain't any") => {})(ctx.count);
          return {};
        })
      ]
    });
  });

  it('context should get inferred for a builtin action within an array of transition actions', () => {
    createMachine({
      schema: {
        context: {} as { count: number }
      },
      on: {
        FOO: {
          actions: [
            'foo',
            assign((ctx) => {
              ((_accept: number) => {})(ctx.count);
              // @ts-expect-error
              ((_accept: "ain't any") => {})(ctx.count);
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
      schema: {
        context: {} as {
          count: number;
          childRef: ActorRefFrom<typeof childMachine>;
        }
      },
      entry: stop((ctx) => {
        ((_accept: number) => {})(ctx.count);
        // @ts-expect-error
        ((_accept: "ain't any") => {})(ctx.count);
        return ctx.childRef;
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
      schema: {
        context: {} as {
          count: number;
          childRef: ActorRefFrom<typeof childMachine>;
        }
      },
      on: {
        FOO: {
          actions: stop((ctx) => {
            ((_accept: number) => {})(ctx.count);
            // @ts-expect-error
            ((_accept: "ain't any") => {})(ctx.count);
            return ctx.childRef;
          })
        }
      }
    });
  });

  it('should report an error when the stop action returns an invalid actor ref', () => {
    createMachine({
      schema: {
        context: {} as {
          count: number;
        }
      },
      entry: stop(
        // @ts-expect-error
        (ctx) => {
          return ctx.count;
        }
      )
    });
  });

  it('context should get inferred for a stop actions within an array of entry actions', () => {
    const childMachine = createMachine({});

    createMachine({
      schema: {
        context: {} as {
          count: number;
          childRef: ActorRefFrom<typeof childMachine>;
          promiseRef: ActorRefFrom<Promise<string>>;
        }
      },
      entry: [
        stop((ctx) => {
          ((_accept: number) => {})(ctx.count);
          // @ts-expect-error
          ((_accept: "ain't any") => {})(ctx.count);
          return ctx.childRef;
        }),
        stop((ctx) => {
          ((_accept: number) => {})(ctx.count);
          // @ts-expect-error
          ((_accept: "ain't any") => {})(ctx.count);
          return ctx.promiseRef;
        })
      ]
    });
  });

  it('should accept assign with partial static object', () => {
    createMachine({
      schema: {
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
      schema: {
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
        count: (context) => context.count + 1,
        skip: true
      })
    });
  });
});
