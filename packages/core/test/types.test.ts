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

describe('Raise events', () => {
  it('should accept a valid event type', () => {
    createMachine({
      types: {} as {
        events: { type: 'FOO' } | { type: 'BAR' };
      },
      entry: raise({
        type: 'FOO'
      })
    });
  });

  it('should reject an invalid event type', () => {
    createMachine({
      types: {} as {
        events: { type: 'FOO' } | { type: 'BAR' };
      },
      entry: raise({
        // @ts-expect-error
        type: 'UNKNOWN'
      })
    });
  });

  it('should reject a string event type', () => {
    const event: { type: string } = { type: 'something' };

    createMachine({
      types: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      // @ts-expect-error
      entry: raise(event)
    });
  });

  it('should provide a narrowed down expression event type when used as a transition action', () => {
    createMachine({
      types: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      on: {
        FOO: {
          actions: raise(({ event }) => {
            ((_arg: 'FOO') => {})(event.type);
            // @ts-expect-error
            ((_arg: 'BAR') => {})(event.type);

            return {
              type: 'BAR' as const
            };
          })
        }
      }
    });
  });

  it('should accept a valid event type returned from an expression', () => {
    createMachine({
      types: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      entry: raise(() => ({
        type: 'BAR' as const
      }))
    });
  });

  it('should reject an invalid event type returned from an expression', () => {
    createMachine({
      types: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      // @ts-expect-error
      entry: raise(() => ({
        type: 'UNKNOWN'
      }))
    });
  });

  it('should reject a string event type returned from an expression', () => {
    const event: { type: string } = { type: 'something' };

    createMachine({
      types: {
        events: {} as { type: 'FOO' } | { type: 'BAR' }
      },
      // @ts-expect-error
      entry: raise(() => event)
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

describe('context', () => {
  it('defined context in createMachine() should be an object', () => {
    createMachine({
      // @ts-expect-error
      context: 'string'
    });
  });

  it('context should be required if present in types', () => {
    createMachine(
      // @ts-expect-error
      {
        types: {} as {
          context: { count: number };
        }
      }
    );

    createMachine({
      types: {} as {
        context: { count: number };
      },
      context: {
        count: 0
      }
    });

    createMachine({
      types: {} as {
        context: { count: number };
      },
      context: () => ({
        count: 0
      })
    });
  });
});

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
      context: {
        count: 0
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
    const toggleMachine = createMachine({
      types: {} as {
        context: {
          count: number;
        };
        events: {
          type: 'TOGGLE';
        };
      },
      context: {
        count: 0
      }
    });

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
      context: {
        count: 0
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
      context: {
        count: 0
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
        },
        context: {
          numbers: []
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
      context: {
        count: 0
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
        },
        context: {
          count: 0
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

describe('actor types', () => {
  it('should reject actor outside of the defined ones at usage site', () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    createMachine({
      types: {} as {
        actors: {
          src: 'child';
          logic: typeof child;
        };
      },
      // @ts-expect-error
      invoke: {
        src: 'other'
      }
    });
  });

  it('should accept a defined actor at usage site', () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    createMachine({
      types: {} as {
        actors: {
          src: 'child';
          logic: typeof child;
        };
      },
      invoke: {
        src: 'child'
      }
    });
  });

  it('should reject actor outside of the defined ones in provided implementations', () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          // @ts-expect-error
          other: child
        }
      }
    );
  });

  it('should accept a defined actor in provided implementations', () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          child
        }
      }
    );
  });

  it(`should reject the provided actor when the output doesn't match`, () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          // @ts-expect-error
          child: fromPromise(() => Promise.resolve(42))
        }
      }
    );
  });

  it(`should reject the provided actor when its output is a super type of the expected one`, () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          // @ts-expect-error
          child: fromPromise(() =>
            Promise.resolve(Math.random() > 0.5 ? 'foo' : 42)
          )
        }
      }
    );
  });

  it(`should accept the provided actor when its output is a sub type of the expected one`, () => {
    const child = fromPromise(() =>
      Promise.resolve(Math.random() > 0.5 ? 'foo' : 42)
    );

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          // TODO: ideally this shouldn't error
          // @ts-expect-error
          child: fromPromise(() => Promise.resolve('foo'))
        }
      }
    );
  });

  it(`should reject static wrong input in the provided implementations`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          child: {
            src: child,
            // @ts-expect-error
            input: 'hello'
          }
        }
      }
    );
  });

  it(`should allow static correct input in the provided implementations`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          child: {
            src: child,
            input: 42
          }
        }
      }
    );
  });

  it(`should allow static input that is a subtype of the expected one`, () => {
    const child = fromPromise(({}: { input: number | string }) =>
      Promise.resolve('foo')
    );

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          child: {
            src: child,
            input: 42
          }
        }
      }
    );
  });

  it(`should reject static input that is a supertype of the expected one`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          child: {
            src: child,
            // @ts-expect-error
            input: Math.random() > 0.5 ? 'string' : 42
          }
        }
      }
    );
  });

  it(`should reject dynamic wrong input in the provided implementations`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          child: {
            src: child,
            // @ts-expect-error
            input: () => 'hello'
          }
        }
      }
    );
  });

  it(`should allow dynamic correct input in the provided implementations`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          child: {
            src: child,
            input: () => 42
          }
        }
      }
    );
  });

  it(`should reject dynamic input that is a supertype of the expected one`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          child: {
            src: child,
            // @ts-expect-error
            input: () => (Math.random() > 0.5 ? 42 : 'hello')
          }
        }
      }
    );
  });

  it(`should allow dynamic input that is a subtype of the expected one`, () => {
    const child = fromPromise(({}: { input: number | string }) =>
      Promise.resolve('foo')
    );

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          child: {
            src: child,
            input: () => 'hello'
          }
        }
      }
    );
  });

  it('should allow an actor with the expected snapshot type', () => {
    const child = createMachine({
      types: {} as {
        context: {
          foo: string;
        };
      },
      context: {
        foo: 'bar'
      }
    });

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          child
        }
      }
    );
  });

  it('should reject an actor with an incorrect snapshot type', () => {
    const child = createMachine({
      types: {} as {
        context: {
          foo: string;
        };
      },
      context: {
        foo: 'bar'
      }
    });

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          // @ts-expect-error
          child: createMachine({
            types: {} as {
              context: {
                foo: number;
              };
            },
            context: {
              foo: 100
            }
          })
        }
      }
    );
  });

  it('should allow an actor with a snapshot type that is a subtype of the expected one', () => {
    const child = createMachine({
      types: {} as {
        context: {
          foo: string | number;
        };
      },
      context: {
        foo: 'bar'
      }
    });

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          // TODO: ideally this should be allowed
          // @ts-expect-error
          child: createMachine({
            types: {} as {
              context: {
                foo: string;
              };
            },
            context: {
              foo: 'bar'
            }
          })
        }
      }
    );
  });

  it('should reject an actor with a snapshot type that is a supertype of the expected one', () => {
    const child = createMachine({
      types: {} as {
        context: {
          foo: string;
        };
      },
      context: {
        foo: 'bar'
      }
    });

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          // @ts-expect-error
          child: createMachine({
            types: {} as {
              context: {
                foo: string | number;
              };
            },
            context: {
              foo: 'bar'
            }
          })
        }
      }
    );
  });

  it('should allow an actor with the expected event types', () => {
    const child = createMachine({
      types: {} as {
        events: {
          type: 'EV_1';
        };
      }
    });

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          child
        }
      }
    );
  });

  it('should reject an actor with wrong event types', () => {
    const child = createMachine({
      types: {} as {
        events: {
          type: 'EV_1';
        };
      }
    });

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          // @ts-expect-error
          child: createMachine({
            types: {} as {
              events: {
                type: 'OTHER';
              };
            }
          })
        }
      }
    );
  });

  it('should reject an actor with an event type that is a subtype of the expected one', () => {
    const child = createMachine({
      types: {} as {
        events:
          | {
              type: 'EV_1';
            }
          | {
              type: 'EV_2';
            };
      }
    });

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          // the provided actor has to be able to handle all the event types that it might receive from the parent here
          // @ts-expect-error
          child: createMachine({
            types: {} as {
              events: {
                type: 'EV_1';
              };
            }
          })
        }
      }
    );
  });

  it('should allow an actor with a snapshot type that is a supertype of the expected one', () => {
    const child = createMachine({
      types: {} as {
        events: {
          type: 'EV_1';
        };
      }
    });

    createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
        }
      },
      {
        actors: {
          // TODO: ideally this should be allowed since the provided actor is capable of handling all the event types that it might receive from the parent here
          // @ts-expect-error
          child: createMachine({
            types: {} as {
              events:
                | {
                    type: 'EV_1';
                  }
                | {
                    type: 'EV_2';
                  };
            }
          })
        }
      }
    );
  });

  it('should return the correct child type on the available snapshot when the ID for the actor was configured', () => {
    const child = createMachine({
      types: {} as {
        context: {
          foo: string;
        };
      },
      context: {
        foo: ''
      }
    });

    const machine = createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            id: 'someChild';
            logic: typeof child;
          };
        },
        invoke: {
          id: 'someChild',
          src: 'child'
        }
      },
      {
        actors: { child }
      }
    );

    const snapshot = interpret(machine).getSnapshot();
    const childSnapshot = snapshot.children.someChild!.getSnapshot();

    ((_accept: string | undefined) => {})(childSnapshot.context.foo);

    ((_accept: string) => {})(childSnapshot.context.foo);

    ((_accept: '') => {})(
      // @ts-expect-error
      childSnapshot.context.foo
    );

    ((_accept: number | undefined) => {})(
      // @ts-expect-error
      childSnapshot.context.foo
    );
  });

  it('should allow valid configured actor id', () => {
    const child = createMachine({});

    createMachine({
      types: {} as {
        actors: {
          src: 'child';
          id: 'ok1' | 'ok2';
          logic: typeof child;
        };
      },
      invoke: {
        id: 'ok1',
        src: 'child'
      }
    });
  });

  it('should disallow invalid actor id', () => {
    const child = createMachine({});

    createMachine({
      types: {} as {
        actors: {
          src: 'child';
          id: 'ok1' | 'ok2';
          logic: typeof child;
        };
      },
      // @ts-expect-error
      invoke: {
        id: 'child',
        src: 'child'
      }
    });
  });

  it('should require id to be specified when it was configured', () => {
    const child = createMachine({});

    createMachine({
      types: {} as {
        actors: {
          src: 'child';
          id: 'ok1' | 'ok2';
          logic: typeof child;
        };
      },
      // @ts-expect-error
      invoke: {
        src: 'child'
      }
    });
  });

  it(`shouldn't require id to be specified when it was not configured`, () => {
    const child = createMachine({});

    createMachine({
      types: {} as {
        actors: {
          src: 'child';
          logic: typeof child;
        };
      },
      invoke: {
        src: 'child'
      }
    });
  });

  it(`should allow id to be specified when it was not configured`, () => {
    const child = createMachine({});

    createMachine({
      types: {} as {
        actors: {
          src: 'child';
          logic: typeof child;
        };
      },
      invoke: {
        id: 'someId',
        src: 'child'
      }
    });
  });

  it(`should not allow anonymous inline actors outside of the configured ones`, () => {
    const child1 = createMachine({
      context: {
        counter: 0
      }
    });

    const child2 = createMachine({
      context: {
        answer: ''
      }
    });

    createMachine({
      types: {} as {
        actors: {
          src: 'child';
          logic: typeof child1;
        };
      },
      // @ts-expect-error
      invoke: {
        src: child2
      }
    });
  });

  it('specific children with id should be optional on the snapshot', () => {
    const child = createMachine({
      context: {
        counter: 0
      }
    });

    const machine = createMachine({
      types: {} as {
        actors: {
          src: 'child';
          id: 'myChild';
          logic: typeof child;
        };
      }
    });

    const childActor = interpret(machine).getSnapshot().children.myChild;

    ((_accept: ActorRefFrom<typeof child> | undefined) => {})(childActor);
    // @ts-expect-error
    ((_accept: ActorRefFrom<typeof child>) => {})(childActor);
  });

  it('specific children without id should be optional on the snapshot', () => {
    const child = createMachine({
      context: {
        counter: 0
      }
    });

    const machine = createMachine({
      types: {} as {
        actors: {
          src: 'child';
          logic: typeof child;
        };
      }
    });

    const childActor = interpret(machine).getSnapshot().children.someChild;

    ((_accept: ActorRefFrom<typeof child> | undefined) => {})(childActor);
    // @ts-expect-error
    ((_accept: ActorRefFrom<typeof child>) => {})(childActor);
  });

  it('when all provided actors have specified ids index signature should not be allowed', () => {
    const child1 = createMachine({
      context: {
        counter: 0
      }
    });

    const child2 = createMachine({
      context: {
        answer: ''
      }
    });

    const machine = createMachine({
      types: {} as {
        actors:
          | {
              src: 'child';
              id: 'counter';
              logic: typeof child1;
            }
          | {
              src: 'child';
              id: 'quiz';
              logic: typeof child2;
            };
      }
    });

    interpret(machine).getSnapshot().children.counter;
    interpret(machine).getSnapshot().children.quiz;
    // @ts-expect-error
    interpret(machine).getSnapshot().children.someChild;
  });

  it('when some provided actors have specified ids index signature should be allowed', () => {
    const child1 = createMachine({
      context: {
        counter: 0
      }
    });

    const child2 = createMachine({
      context: {
        answer: ''
      }
    });

    const machine = createMachine({
      types: {} as {
        actors:
          | {
              src: 'child';
              id: 'counter';
              logic: typeof child1;
            }
          | {
              src: 'child';
              logic: typeof child2;
            };
      }
    });

    const counterActor = interpret(machine).getSnapshot().children.counter;
    ((_accept: ActorRefFrom<typeof child1> | undefined) => {})(counterActor);

    const someActor = interpret(machine).getSnapshot().children.someChild;
    // @ts-expect-error
    ((_accept: ActorRefFrom<typeof child2> | undefined) => {})(someActor);
    ((
      _accept:
        | ActorRefFrom<typeof child1>
        | ActorRefFrom<typeof child2>
        | undefined
    ) => {})(someActor);
  });
});

describe('invoke onDone targets', () => {
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
      context: {
        count: 0
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
      context: {
        count: 0
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
      context: ({ spawn }) => ({
        count: 0,
        childRef: spawn(childMachine)
      }),
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
      context: ({ spawn }) => ({
        count: 0,
        childRef: spawn(childMachine)
      }),
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
      context: {
        count: 0
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
      context: ({ spawn }) => ({
        count: 0,
        childRef: spawn(childMachine),
        promiseRef: spawn(fromPromise(() => Promise.resolve('foo')))
      }),
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
