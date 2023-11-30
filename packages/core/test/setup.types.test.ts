import {
  ActorRefFrom,
  and,
  assign,
  createActor,
  createMachine,
  fromPromise,
  fromTransition,
  not,
  raise,
  sendTo,
  setup,
  spawnChild
} from '../src';

describe('setup()', () => {
  it('should be able to define a simple function guard', () => {
    setup({
      guards: {
        check: () => true
      }
    });
  });

  it('should be able to define a function guard with params', () => {
    setup({
      guards: {
        check: (_, params: number) => true
      }
    });
  });

  it('should be able to define a function guard that depends on context', () => {
    setup({
      types: {} as {
        context: { enabled: boolean };
      },
      guards: {
        check: ({ context }) => context.enabled
      }
    });
  });

  it('should be able to define a `not` guard referencing another defined simple function guard using a string', () => {
    setup({
      guards: {
        check: () => true,
        opposite: not('check')
      }
    });
  });

  it('should not accept a `not` guard referencing an unknown guard using a string', () => {
    setup({
      guards: {
        check: () => true,
        // @ts-expect-error
        opposite: not('unknown')
      }
    });
  });

  it('should be able to define a `not` guard referencing another defined simple function guard using an object', () => {
    setup({
      guards: {
        check: () => true,
        opposite: not({
          type: 'check'
        })
      }
    });
  });

  it('should not accept a `not` guard referencing an unknown guard using an object', () => {
    setup({
      guards: {
        check: () => true,
        // @ts-expect-error
        opposite: not({
          type: 'unknown'
        })
      }
    });
  });

  it('should be able to define a `not` guard referencing another guard with its required params', () => {
    setup({
      guards: {
        check: (_, params: string) => true,
        opposite: not({
          type: 'check',
          params: 'bar'
        })
      }
    });
  });

  it('should not accept a `not` guard referencing another guard using a string without its required params', () => {
    setup({
      guards: {
        check: (_, params: string) => true,
        // @ts-expect-error
        opposite: not('check')
      }
    });
  });

  it('should not accept a `not` guard referencing another guard using an object without its required params', () => {
    setup({
      guards: {
        check: (_, params: string) => true,
        // @ts-expect-error
        opposite: not({
          type: 'check'
        })
      }
    });
  });

  it('should be able to define a `not` guard referencing another guard with a required mutable array params', () => {
    setup({
      guards: {
        check: (_, params: string[]) => true,
        opposite: not({
          type: 'check',
          params: ['bar', 'baz']
        })
      }
    });
  });

  it('should be able to define a `not` guard that embeds an inline function guard', () => {
    setup({
      guards: {
        opposite: not(() => true)
      }
    });
  });

  it('should be able to define a `not` guard that embeds an inline function guard that depends on context', () => {
    setup({
      types: {} as {
        context: { enabled: boolean };
      },
      guards: {
        opposite: not(({ context }) => context.enabled)
      }
    });
  });

  it('should not be able to define a `not` guard that embeds an inline function guard with params', () => {
    setup({
      types: {} as {
        // TODO: without TContext candidate here the `not` infers the outer `TContext` type variable
        // that looks like a bug in TypeScript, it should infer its constraint.
        // It would be great to create a repro case for this problem
        context: { counter: number };
      },
      guards: {
        opposite: not(
          // @ts-expect-error
          (_, params: string) => true
        )
      }
    });
  });

  it('should be able to define an `and` guard that references multiple different guards using strings', () => {
    setup({
      guards: {
        check1: () => true,
        check2: () => true,
        combinedCheck: and(['check1', 'check2'])
      }
    });
  });

  it('should not accept an `and` guard referencing an unknown guard using a string', () => {
    setup({
      guards: {
        check1: () => true,
        check2: () => true,
        // @ts-expect-error
        combinedCheck: and(['check1', 'unknown'])
      }
    });
  });

  it('should be able to define an `and` guard that references multiple different guards using objects', () => {
    setup({
      guards: {
        check1: (_, params: string) => true,
        check2: (_, params: number) => true,
        combinedCheck: and([
          {
            type: 'check1',
            params: 'bar'
          },
          {
            type: 'check2',
            params: 42
          }
        ])
      }
    });
  });

  it('should be able to define an `and` guard that references multiple different guards using both strings and objects', () => {
    setup({
      guards: {
        check1: (_) => true,
        check2: (_, params: number) => true,
        combinedCheck: and([
          'check1',
          {
            type: 'check2',
            params: 42
          }
        ])
      }
    });
  });

  it('should not accept an `and` guard referencing another guard using a string without its required params', () => {
    setup({
      guards: {
        check1: (_) => true,
        check2: (_, params: number) => true,
        // @ts-expect-error
        combinedCheck: and(['check1', 'check2'])
      }
    });
  });

  it('should not accept an `and` guard referencing another guard using an object without its required params', () => {
    setup({
      guards: {
        check1: (_) => true,
        check2: (_, params: number) => true,
        // @ts-expect-error
        combinedCheck: and([
          'check1',
          {
            type: 'check2'
          }
        ])
      }
    });
  });

  it('should be able to define an `and` guard that embeds an inline `not` guard referencing another guard using a string', () => {
    setup({
      guards: {
        check1: (_) => true,
        check2: (_) => true,
        combinedCheck: and(['check1', not('check2')])
      }
    });
  });

  it('should not accept an `and` guard that embeds an inline `not` guard referencing an unknown guard using a string', () => {
    setup({
      guards: {
        check1: (_) => true,
        check2: (_) => true,
        // @ts-expect-error
        combinedCheck: and(['check1', not('unknown')])
      }
    });
  });

  it('should be able to define an `and` guard that embeds an inline `not` guard referencing another guard using an object', () => {
    setup({
      guards: {
        check1: (_) => true,
        check2: (_) => true,
        combinedCheck: and([
          'check1',
          not({
            type: 'check2'
          })
        ])
      }
    });
  });

  it('should not accept an `and` guard that embeds an inline `not` guard referencing an unknown guard using an object', () => {
    setup({
      guards: {
        check1: (_) => true,
        check2: (_) => true,
        // @ts-expect-error
        combinedCheck: and([
          'check1',
          not({
            type: 'unknown'
          })
        ])
      }
    });
  });

  it('should be able to define an `and` guard that embeds an inline `not` guard embedding an inline function guard', () => {
    setup({
      guards: {
        check1: (_) => true,
        check2: (_) => true,
        combinedCheck: and(['check1', not(() => true)])
      }
    });
  });

  it('should be able to use a parameterized `assign` action with its required params in the machine', () => {
    setup({
      types: {} as {
        context: {
          count: number;
        };
      },
      actions: {
        resetTo: assign((_, params: number) => ({
          count: params
        }))
      }
    }).createMachine({
      context: {
        count: 0
      },
      entry: {
        type: 'resetTo',
        params: 0
      }
    });
  });

  it('should not accept a string reference to parameterized `assign` without its required params in the machine', () => {
    setup({
      types: {} as {
        context: {
          count: number;
        };
      },
      actions: {
        resetTo: assign((_, params: number) => ({
          count: params
        }))
      }
    }).createMachine({
      // @ts-expect-error
      entry: 'resetTo'
    });
  });

  it('should not accept an object reference to parameterized `assign` without its required params in the machine', () => {
    setup({
      types: {} as {
        context: {
          count: number;
        };
      },
      actions: {
        resetTo: assign((_, params: number) => ({
          count: params
        }))
      }
    }).createMachine({
      // @ts-expect-error
      entry: {
        type: 'resetTo'
      }
    });
  });

  it('should not accept an object reference to parameterized `assign` without its required params in the machine', () => {
    setup({
      types: {} as {
        context: {
          count: number;
        };
      },
      actions: {
        resetTo: assign((_, params: number) => ({
          count: params
        }))
      }
    }).createMachine({
      // @ts-expect-error
      entry: {
        type: 'resetTo'
      }
    });
  });

  it('should not accept a reference to parameterized `assign` with wrong params in the machine', () => {
    setup({
      types: {} as {
        context: {
          count: number;
        };
      },
      actions: {
        resetTo: assign((_, params: number) => ({
          count: params
        }))
      }
    }).createMachine({
      // @ts-expect-error
      entry: {
        type: 'resetTo',
        params: 'foo'
      }
    });
  });

  it('should not accept a string reference to an unknown action in the machine', () => {
    setup({
      actions: {
        doStuff: () => {}
      }
    }).createMachine({
      // @ts-expect-error
      entry: 'unknown'
    });
  });

  it('should not accept an object reference to an unknown action in the machine', () => {
    setup({
      actions: {
        doStuff: () => {}
      }
    }).createMachine({
      // @ts-expect-error
      entry: {
        type: 'unknown'
      }
    });
  });

  it('should accept an `assign` with a spawner that tries to spawn a known actor', () => {
    setup({
      actors: {
        fetchUser: fromPromise(async () => ({ name: 'Andarist' }))
      },
      actions: {
        spawnFetcher: assign(({ spawn }) => {
          return {
            child: spawn('fetchUser')
          };
        })
      }
    });
  });

  it('should not accept an `assign` with a spawner that tries to spawn an unknown actor', () => {
    setup({
      actors: {
        fetchUser: fromPromise(async () => ({ name: 'Andarist' }))
      },
      actions: {
        spawnFetcher: assign(({ spawn }) => {
          return {
            child:
              // @ts-expect-error
              spawn('unknown')
          };
        })
      }
    });
  });

  it('should accept a `spawnChild` action that tries to spawn a known actor', () => {
    setup({
      actors: {
        fetchUser: fromPromise(async () => ({ name: 'Andarist' }))
      },
      actions: {
        spawnFetcher: spawnChild('fetchUser')
      }
    });
  });

  it('should not accept a `spawnChild` action that tries to spawn an unknown actor', () => {
    setup({
      actors: {
        fetchUser: fromPromise(async () => ({ name: 'Andarist' }))
      },
      actions: {
        spawnFetcher:
          // @ts-expect-error
          spawnChild('unknown')
      }
    });
  });

  it('should accept a `raise` action that raises a known event', () => {
    setup({
      types: {} as {
        events:
          | {
              type: 'FOO';
            }
          | {
              type: 'BAR';
            };
      },
      actions: {
        raiseFoo: raise({
          type: 'FOO'
        })
      }
    });
  });

  it('should not accept a `raise` action that raises a unknown event', () => {
    setup({
      types: {} as {
        events:
          | {
              type: 'FOO';
            }
          | {
              type: 'BAR';
            };
      },
      actions: {
        raiseFoo: raise({
          // @ts-expect-error
          type: 'BAZ'
        })
      }
    });
  });

  it('should accept a `raise` action that references a known delay', () => {
    setup({
      types: {} as {
        events:
          | {
              type: 'FOO';
            }
          | {
              type: 'BAR';
            };
      },
      actions: {
        raiseFoo: raise(
          {
            type: 'FOO'
          },
          {
            delay: 'hundred'
          }
        )
      },
      delays: {
        hundred: 100
      }
    });
  });

  it('should not accept a `raise` action that references a unknown delay', () => {
    setup({
      types: {} as {
        events:
          | {
              type: 'FOO';
            }
          | {
              type: 'BAR';
            };
      },
      actions: {
        raiseFoo: raise(
          {
            type: 'FOO'
          },
          {
            // @ts-expect-error
            delay: 'hundred'
          }
        )
      },
      delays: {
        thousand: 1000
      }
    });
  });

  it('should accept a `sendTo` action that references a known delay', () => {
    setup({
      types: {} as {
        events:
          | {
              type: 'FOO';
            }
          | {
              type: 'BAR';
            };
      },
      actions: {
        sendFoo: sendTo(
          ({ self }) => self,
          {
            type: 'FOO'
          },
          {
            delay: 'hundred'
          }
        )
      },
      delays: {
        hundred: 100
      }
    });
  });

  it('should not accept a `sendTo` action that references a unknown delay', () => {
    setup({
      types: {} as {
        events:
          | {
              type: 'FOO';
            }
          | {
              type: 'BAR';
            };
      },
      actions: {
        sendFoo: sendTo(
          ({ self }) => self,
          {
            type: 'FOO'
          },
          {
            // @ts-expect-error
            delay: 'hundred'
          }
        )
      },
      delays: {
        thousand: 1000
      }
    });
  });

  it("should be able to use an output of specific actor in the `assign` within `invoke`'s `onDone` in the machine", () => {
    setup({
      actors: {
        greet: fromPromise(async () => 'hello'),
        throwDice: fromPromise(async () => Math.random())
      }
    }).createMachine({
      invoke: {
        src: 'greet',
        onDone: {
          actions: assign({
            data: ({ event }) => {
              event.output satisfies string;

              // @ts-expect-error
              event.output satisfies number;
              return {};
            }
          })
        }
      }
    });
  });

  it("should be able to use an output of specific actor in the custom action within `invoke`'s `onDone` in the machine", () => {
    setup({
      actors: {
        greet: fromPromise(async () => 'hello'),
        throwDice: fromPromise(async () => Math.random())
      }
    }).createMachine({
      invoke: {
        src: 'greet',
        onDone: {
          actions: ({ event }) => {
            event.output satisfies string;

            // @ts-expect-error
            event.output satisfies number;
          }
        }
      }
    });
  });

  it('should accept a compatible provided logic', () => {
    setup({
      actors: {
        reducer: fromTransition((s) => s, { count: 42 })
      }
    })
      .createMachine({})
      .provide({
        actors: {
          reducer: fromTransition((s) => s, { count: 100 })
        }
      });
  });

  it('should not accept an incompatible provided logic', () => {
    setup({
      actors: {
        reducer: fromTransition((s) => s, { count: 42 })
      }
    })
      .createMachine({})
      .provide({
        actors: {
          // @ts-expect-error
          reducer: fromTransition((s) => s, '')
        }
      });
  });

  it('should allow actors to be defined without children', () => {
    setup({
      actors: {
        foo: createMachine({})
      }
    });
  });

  it('should allow actors to be defined with children', () => {
    setup({
      types: {} as {
        children: {
          first: 'foo';
          second: 'bar';
        };
      },
      actors: {
        foo: createMachine({}),
        bar: createMachine({})
      }
    });
  });

  it('should not allow actors to be defined without all required children', () => {
    setup({
      types: {} as {
        children: {
          first: 'foo';
          second: 'bar';
        };
      },
      // @ts-expect-error
      actors: {
        foo: createMachine({})
      }
    });
  });

  it('should allow more actors to be defined than the ones required by children', () => {
    setup({
      types: {} as {
        children: {
          first: 'foo';
          second: 'bar';
        };
      },
      actors: {
        foo: createMachine({}),
        bar: createMachine({}),
        baz: createMachine({})
      }
    });
  });

  it(`should provide contextual parameters to input factory for an actor that doesn't specify any input`, () => {
    setup({
      types: {
        context: {} as { count: number }
      },
      actors: {
        child: fromPromise(() => Promise.resolve(1))
      }
    }).createMachine({
      context: { count: 1 },
      invoke: {
        src: 'child',
        input: ({ context }) => {
          // @ts-expect-error
          context.foo;

          return undefined;
        }
      }
    });
  });

  it('should return the correct child type on the available snapshot when the child ID for the actor was configured', () => {
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

    const machine = setup({
      types: {} as {
        children: {
          someChild: 'child';
        };
      },
      actors: {
        child
      }
    }).createMachine({
      invoke: {
        id: 'someChild',
        src: 'child'
      }
    });

    const snapshot = createActor(machine).getSnapshot();
    const childSnapshot = snapshot.children.someChild!.getSnapshot();

    childSnapshot.context.foo satisfies string | undefined;
    childSnapshot.context.foo satisfies string;
    // @ts-expect-error
    childSnapshot.context.foo satisfies '';
    // @ts-expect-error
    childSnapshot.context.foo satisfies number | undefined;
  });

  it('should have an optional child on the available snapshot when the child ID for the actor was configured', () => {
    const child = createMachine({
      context: {
        counter: 0
      }
    });

    const machine = setup({
      types: {} as {
        children: {
          myChild: 'child';
        };
      },
      actors: {
        child
      }
    }).createMachine({});

    const childActor = createActor(machine).getSnapshot().children.myChild;

    childActor satisfies ActorRefFrom<typeof child> | undefined;
    // @ts-expect-error
    childActor satisfies ActorRefFrom<typeof child>;
  });

  it('should have an optional child on the available snapshot when the child ID for the actor was not configured', () => {
    const child = createMachine({
      context: {
        counter: 0
      }
    });

    const machine = setup({
      actors: {
        child
      }
    }).createMachine({});

    const childActor = createActor(machine).getSnapshot().children.someChild;

    childActor satisfies ActorRefFrom<typeof child> | undefined;
    // @ts-expect-error
    childActor satisfies ActorRefFrom<typeof child>;
  });

  it('should not have an index signature on the available snapshot when child IDs were configured for all actors', () => {
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

    const machine = setup({
      types: {} as {
        children: {
          counter: 'child1';
          quiz: 'child2';
        };
      },
      actors: {
        child1,
        child2
      }
    }).createMachine({});

    createActor(machine).getSnapshot().children.counter;
    createActor(machine).getSnapshot().children.quiz;
    // @ts-expect-error
    createActor(machine).getSnapshot().children.someChild;
  });

  it('should have an index signature on the available snapshot when child IDs were configured only for some actors', () => {
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

    const machine = setup({
      types: {} as {
        children: {
          counter: 'child1';
        };
      },
      actors: {
        child1,
        child2
      }
    }).createMachine({});

    const counterActor = createActor(machine).getSnapshot().children.counter;
    counterActor satisfies ActorRefFrom<typeof child1> | undefined;

    const someActor = createActor(machine).getSnapshot().children.someChild;
    // @ts-expect-error
    someActor satisfies ActorRefFrom<typeof child2> | undefined;
    someActor satisfies
      | ActorRefFrom<typeof child1>
      | ActorRefFrom<typeof child2>
      | undefined;
  });

  it('should type the snapshot state value of a stateless machine as an empty object', () => {
    const machine = setup({}).createMachine({});

    const snapshot = createActor(machine).getSnapshot();

    type ExpectedType = {};

    snapshot.value satisfies ExpectedType;
    ({}) as ExpectedType satisfies ExpectedType;

    // @ts-expect-error
    snapshot.value.unknown;
  });

  it('should type the snapshot state value of a simple FSM as a union of strings', () => {
    const machine = setup({}).createMachine({
      initial: 'a',
      states: {
        a: {},
        b: {}
      }
    });

    const snapshot = createActor(machine).getSnapshot();

    type ExpectedType = 'a' | 'b';

    snapshot.value satisfies ExpectedType;
    ({}) as ExpectedType satisfies ExpectedType;
  });

  it('should type the snapshot state value without including history state keys', () => {
    const machine = setup({}).createMachine({
      initial: 'a',
      states: {
        a: {},
        b: {},
        c: {
          type: 'history'
        }
      }
    });

    const snapshot = createActor(machine).getSnapshot();

    type ExpectedType = 'a' | 'b';

    snapshot.value satisfies ExpectedType;
    ({}) as ExpectedType satisfies ExpectedType;
  });

  it('should type the snapshot state value of a nested statechart using optional properties for parent states keys', () => {
    const machine = setup({}).createMachine({
      initial: 'a',
      states: {
        a: {
          initial: 'a1',
          states: {
            a1: {},
            a2: {}
          }
        },
        b: {
          initial: 'b1',
          states: {
            b1: {},
            b2: {}
          }
        }
      }
    });

    const snapshot = createActor(machine).getSnapshot();

    type ExpectedType = {
      a?: 'a1' | 'a2';
      b?: 'b1' | 'b2';
    };

    snapshot.value satisfies ExpectedType;
    ({}) as ExpectedType satisfies typeof snapshot.value;
  });

  it('should type the snapshot state value of a parallel state using required properties for its children', () => {
    const machine = setup({}).createMachine({
      type: 'parallel',
      states: {
        a: {
          initial: 'a1',
          states: {
            a1: {},
            a2: {}
          }
        },
        b: {
          initial: 'b1',
          states: {
            b1: {},
            b2: {}
          }
        }
      }
    });

    const snapshot = createActor(machine).getSnapshot();

    type ExpectedType = {
      a: 'a1' | 'a2';
      b: 'b1' | 'b2';
    };

    snapshot.value satisfies ExpectedType;
    ({}) as ExpectedType satisfies typeof snapshot.value;
  });

  it('should type the snapshot state value of an empty parallel region as an empty object', () => {
    const machine = setup({}).createMachine({
      type: 'parallel',
      states: {
        a: {},
        b: {
          initial: 'b1',
          states: {
            b1: {},
            b2: {}
          }
        }
      }
    });

    const snapshot = createActor(machine).getSnapshot();

    type ExpectedType = {
      a: {};
      b: 'b1' | 'b2';
    };

    snapshot.value satisfies ExpectedType;
    ({}) as ExpectedType satisfies typeof snapshot.value;
  });

  it('should type the snapshot state value of a statechart with nested compound states', () => {
    const machine = setup({}).createMachine({
      initial: 'a',
      states: {
        a: {},
        b: {
          initial: 'b1',
          states: {
            b1: {
              initial: 'b11',
              states: {
                b11: {},
                b12: {}
              }
            },
            b2: {}
          }
        }
      }
    });

    const snapshot = createActor(machine).getSnapshot();

    type ExpectedType =
      | 'a'
      | {
          b?:
            | 'b2'
            | {
                b1?: 'b11' | 'b12';
              };
        };

    snapshot.value satisfies ExpectedType;
    ({}) as ExpectedType satisfies typeof snapshot.value;
  });

  it('should accept `assign` when no actor and children types are provided', () => {
    setup({}).createMachine({
      on: {
        RESTART: {
          actions: assign({})
        }
      }
    });
  });

  it('should not allow matching against any value when the machine has no states', () => {
    const machine = setup({}).createMachine({});

    const snapshot = createActor(machine).start().getSnapshot();

    snapshot.matches(
      // @ts-expect-error
      {}
    );
    snapshot.matches(
      // @ts-expect-error
      'pending'
    );
    snapshot.matches(
      // @ts-expect-error
      {
        foo: 'pending'
      }
    );
  });

  it('should allow matching against a valid string value of a simple FSM', () => {
    const machine = setup({}).createMachine({
      initial: 'green',
      states: {
        green: {},
        yellow: {},
        red: {}
      }
    });

    const snapshot = createActor(machine).start().getSnapshot();

    snapshot.matches('green');
    snapshot.matches('yellow');
    snapshot.matches('red');
  });

  it('should not allow matching against a invalid string value of a simple FSM', () => {
    const machine = setup({}).createMachine({
      initial: 'green',
      states: {
        green: {},
        yellow: {},
        red: {}
      }
    });

    const snapshot = createActor(machine).start().getSnapshot();

    snapshot.matches(
      // @ts-expect-error
      'orange'
    );
  });

  it('should not allow matching against an empty object value of a simple FSM', () => {
    const machine = setup({}).createMachine({
      initial: 'green',
      states: {
        green: {},
        yellow: {},
        red: {}
      }
    });

    const snapshot = createActor(machine).start().getSnapshot();

    snapshot.matches(
      // @ts-expect-error
      {}
    );
  });

  it('should not allow matching against an object value with a key that is a valid value of a simple FSM', () => {
    const machine = setup({}).createMachine({
      initial: 'green',
      states: {
        green: {},
        yellow: {},
        red: {}
      }
    });

    const snapshot = createActor(machine).start().getSnapshot();

    snapshot.matches(
      // @ts-expect-error
      {
        green: {}
      }
    );
  });

  it('should allow matching against valid top state keys of a statechart with nested compound states', () => {
    const machine = setup({}).createMachine({
      initial: 'green',
      states: {
        green: {
          initial: 'walk',
          states: {
            walk: {},
            wait: {}
          }
        },
        yellow: {},
        red: {}
      }
    });

    const snapshot = createActor(machine).start().getSnapshot();

    snapshot.matches('green');
    snapshot.matches('yellow');
    snapshot.matches('red');
  });

  it('should not allow matching against an invalid top state key of a statechart with nested compound states', () => {
    const machine = setup({}).createMachine({
      initial: 'green',
      states: {
        green: {
          initial: 'walk',
          states: {
            walk: {},
            wait: {}
          }
        },
        yellow: {},
        red: {}
      }
    });

    const snapshot = createActor(machine).start().getSnapshot();

    snapshot.matches(
      // @ts-expect-error
      'orange'
    );
  });

  it('should allow matching against a valid full object value of a statechart with nested compound states', () => {
    const machine = setup({}).createMachine({
      initial: 'green',
      states: {
        green: {
          initial: 'walk',
          states: {
            walk: {},
            wait: {}
          }
        },
        yellow: {},
        red: {}
      }
    });

    const snapshot = createActor(machine).start().getSnapshot();

    snapshot.matches({
      green: 'wait'
    });
  });

  it('should allow matching against a valid non-full object value of a statechart with nested compound states', () => {
    const machine = setup({}).createMachine({
      initial: 'green',
      states: {
        green: {
          initial: 'walk',
          states: {
            walk: {
              initial: 'steady',
              states: {
                steady: {},
                slowingDown: {}
              }
            },
            wait: {}
          }
        },
        yellow: {},
        red: {}
      }
    });

    const snapshot = createActor(machine).start().getSnapshot();

    snapshot.matches({
      green: 'wait'
    });
  });

  it('should not allow matching against a invalid object value of a statechart with nested compound states', () => {
    const machine = setup({}).createMachine({
      initial: 'green',
      states: {
        green: {
          initial: 'walk',
          states: {
            walk: {},
            wait: {}
          }
        },
        yellow: {},
        red: {}
      }
    });

    const snapshot = createActor(machine).start().getSnapshot();

    snapshot.matches({
      // @ts-expect-error
      green: 'invalid'
    });
  });

  it('should not allow matching against a invalid object value with self-key at value position', () => {
    const machine = setup({}).createMachine({
      initial: 'green',
      states: {
        green: {
          initial: 'walk',
          states: {
            walk: {},
            wait: {}
          }
        },
        yellow: {},
        red: {}
      }
    });

    const snapshot = createActor(machine).start().getSnapshot();

    snapshot.matches({
      // @ts-expect-error
      green: 'green'
    });
  });
});
