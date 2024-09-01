import {
  ActorRefFrom,
  and,
  assign,
  cancel,
  ContextFrom,
  createActor,
  createMachine,
  emit,
  enqueueActions,
  EventFrom,
  fromPromise,
  fromTransition,
  log,
  matchesState,
  not,
  raise,
  sendParent,
  sendTo,
  setup,
  spawnChild,
  stopChild
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

  it('should not accept a string reference to an unknown action in the machine when actions were configured', () => {
    setup({
      actions: {
        doStuff: () => {}
      }
    }).createMachine({
      // @ts-expect-error
      entry: 'unknown'
    });
  });

  it('should not accept a string reference to an unknown action in the machine when actions were not configured', () => {
    setup({}).createMachine({
      // @ts-expect-error
      entry: 'unknown'
    });
  });

  it('should not accept an object reference to an unknown action in the machine when actions were configured', () => {
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

  it('should not accept an object reference to an unknown action in the machine when actions were not configured', () => {
    setup({}).createMachine({
      entry: {
        // @ts-expect-error
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

  it('should not accept an `assign` with a spawner that tries to spawn an unknown actor when actors are configured', () => {
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

  it('should not accept an `assign` with a spawner that tries to spawn an unknown actor when actors are not configured', () => {
    setup({
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

  it('should not accept an invoke that tries to invoke an unknown actor when actors are not configured', () => {
    setup({}).createMachine({
      invoke: {
        // @ts-expect-error
        src: 'unknown'
      }
    });
  });

  it('should not accept a non-logic actor when children were not configured', () => {
    setup({
      actors: {
        // @ts-expect-error
        increment: 'bazinga'
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

  it('should not accept a `spawnChild` action that tries to spawn an unknown actor when actors are configured', () => {
    setup({
      actors: {
        fetchUser: fromPromise(async () => ({ name: 'Andarist' }))
      },
      actions: {
        spawnFetcher: spawnChild(
          // @ts-expect-error
          'unknown'
        )
      }
    });
  });

  it('should not accept a `spawnChild` action that tries to spawn an unknown actor when actors are not configured', () => {
    setup({
      actions: {
        spawnFetcher: spawnChild(
          // @ts-expect-error
          'unknown'
        )
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

  it('should not accept a `raise` action that raises an unknown event', () => {
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

  it('should not accept a `raise` action that references an unknown delay when delays are configured', () => {
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

  it('should not accept a `raise` action that references an unknown delay when delays are not configured', () => {
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

  it('should not accept a `sendTo` action that references an unknown delay when delays are configured', () => {
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

  it('should not accept a `sendTo` action that references an unknown delay when delays are not configured', () => {
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
      }
    });
  });

  it('should accept a `sendTo` action that send an event to `self` when delays are not configured', () => {
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
        sendFoo: sendTo(({ self }) => self, {
          type: 'FOO'
        })
      }
    });
  });

  it('should accept a `sendParent` action when delays are not configured', () => {
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
        sendFoo: sendParent({
          type: 'FOO'
        })
      }
    });
  });

  it('should accept an `emit` action that emits a known event', () => {
    setup({
      types: {} as {
        emitted:
          | {
              type: 'FOO';
            }
          | {
              type: 'BAR';
            };
      },
      actions: {
        emitFoo: emit({
          type: 'FOO'
        })
      }
    });
  });

  it('should not accept an `emit` action that emits an unknown event', () => {
    setup({
      types: {} as {
        emitted:
          | {
              type: 'FOO';
            }
          | {
              type: 'BAR';
            };
      },
      actions: {
        emitFoo: emit({
          // @ts-expect-error
          type: 'BAZ'
        })
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

  it('should allow anonymous inline actor outside of the configured actors', () => {
    setup({
      actors: {
        known: fromPromise(async () => 'known')
      }
    }).createMachine({
      invoke: {
        src: fromPromise(async () => 'inline')
      }
    });
  });

  it('should disallow anonymous inline actor with an id outside of the configured actors', () => {
    setup({
      actors: {
        known: fromPromise(async () => 'known')
      }
    }).createMachine({
      invoke: {
        src: fromPromise(async () => 'inline'),
        // @ts-expect-error
        id: 'myChild'
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

  it('should require actors to be defined when children are configured', () => {
    setup(
      // @ts-expect-error
      {
        types: {} as {
          children: {
            first: 'foo';
            second: 'bar';
          };
        }
      }
    );
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

  it('should allow an actor with input to be provided', () => {
    setup({
      actors: {
        fetchUser: fromPromise(
          async ({ input }: { input: { userId: string } }) => ({
            id: input.userId,
            name: 'Andarist'
          })
        )
      }
    });
  });

  it(`should reject static wrong input when invoking a provided actor`, () => {
    setup({
      actors: {
        fetchUser: fromPromise(
          async ({ input }: { input: { userId: string } }) => ({
            id: input.userId,
            name: 'Andarist'
          })
        )
      }
    }).createMachine({
      invoke: {
        src: 'fetchUser',
        // @ts-expect-error
        input: 4157
      }
    });
  });

  it(`should allow static correct input when invoking a provided actor`, () => {
    setup({
      actors: {
        fetchUser: fromPromise(
          async ({ input }: { input: { userId: string } }) => ({
            id: input.userId,
            name: 'Andarist'
          })
        )
      }
    }).createMachine({
      invoke: {
        src: 'fetchUser',
        input: {
          userId: '4nd4r157'
        }
      }
    });
  });

  it(`should allow static input that is a subtype of the expected one when invoking a provided actor`, () => {
    setup({
      actors: {
        child: fromPromise(({}: { input: number | string }) =>
          Promise.resolve('foo')
        )
      }
    }).createMachine({
      invoke: {
        src: 'child',
        input: 42
      }
    });
  });

  it(`should reject static input that is a supertype of the expected one when invoking a provided actor`, () => {
    setup({
      actors: {
        fetchUser: fromPromise(
          async ({ input }: { input: { userId: string } }) => ({
            id: input.userId,
            name: 'Andarist'
          })
        )
      }
    }).createMachine({
      invoke: {
        src: 'fetchUser',
        // @ts-expect-error
        input:
          Math.random() > 0.5
            ? {
                userId: '4nd4r157'
              }
            : 42
      }
    });
  });

  it(`should reject dynamic wrong input when invoking a provided actor`, () => {
    setup({
      actors: {
        fetchUser: fromPromise(
          async ({ input }: { input: { userId: string } }) => ({
            id: input.userId,
            name: 'Andarist'
          })
        )
      }
    }).createMachine({
      invoke: {
        src: 'fetchUser',
        // @ts-expect-error
        input: () => 42
      }
    });
  });

  it(`should allow dynamic correct input when invoking a provided actor`, () => {
    setup({
      actors: {
        fetchUser: fromPromise(
          async ({ input }: { input: { userId: string } }) => ({
            id: input.userId,
            name: 'Andarist'
          })
        )
      }
    }).createMachine({
      invoke: {
        src: 'fetchUser',
        input: () => ({
          userId: '4nd4r157'
        })
      }
    });
  });

  it(`should reject dynamic input that is a supertype of the expected one when invoking a provided actor`, () => {
    setup({
      actors: {
        fetchUser: fromPromise(
          async ({ input }: { input: { userId: string } }) => ({
            id: input.userId,
            name: 'Andarist'
          })
        )
      }
    }).createMachine({
      invoke: {
        src: 'fetchUser',
        // @ts-expect-error
        input: () =>
          Math.random() > 0.5
            ? {
                userId: '4nd4r157'
              }
            : 42
      }
    });
  });

  it(`should allow dynamic input that is a subtype of the expected one when invoking a provided actor`, () => {
    setup({
      actors: {
        child: fromPromise(({}: { input: number | string }) =>
          Promise.resolve('foo')
        )
      }
    }).createMachine({
      invoke: {
        src: 'child',
        input: () => 'hello'
      }
    });
  });

  it(`should reject a valid input of a different provided actor when invoking a provided actor`, () => {
    setup({
      actors: {
        fetchUser: fromPromise(
          async ({ input }: { input: { userId: string } }) => ({
            id: input.userId,
            name: 'Andarist'
          })
        ),
        rollADie: fromPromise(async ({ input }: { input: number }) =>
          Math.min(Math.random(), input)
        )
      }
    }).createMachine({
      invoke: {
        src: 'fetchUser',
        // @ts-expect-error
        input: 0.31
      }
    });
  });

  it(`should require input to be specified when it is required by the invoked actor`, () => {
    setup({
      actors: {
        fetchUser: fromPromise(
          async ({ input }: { input: { userId: string } }) => ({
            id: input.userId,
            name: 'Andarist'
          })
        )
      }
    }).createMachine({
      // @ts-expect-error
      invoke: {
        src: 'fetchUser'
      }
    });
  });

  it(`should not require input when it's optional in the invoked actor`, () => {
    setup({
      actors: {
        rollADie: fromPromise(
          async ({ input }: { input: number | undefined }) =>
            input ? Math.min(Math.random(), input) : Math.random()
        )
      }
    }).createMachine({
      invoke: {
        src: 'rollADie'
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

    type ExpectedType =
      | {
          a: 'a1' | 'a2';
        }
      | {
          b: 'b1' | 'b2';
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
          b:
            | 'b2'
            | {
                b1: 'b11' | 'b12';
              };
        };

    snapshot.value satisfies ExpectedType;
    ({}) as ExpectedType satisfies typeof snapshot.value;
  });

  it('state.value from setup state machine actors should be strongly-typed', () => {
    const machine = setup({}).createMachine({
      initial: 'green',
      states: {
        green: {},
        yellow: {},
        red: {
          initial: 'walk',
          states: {
            walk: {},
            wait: {},
            stop: {}
          }
        },
        emergency: {
          type: 'parallel',
          states: {
            main: {
              initial: 'blinking',
              states: {
                blinking: {}
              }
            },
            cross: {
              initial: 'blinking',
              states: {
                blinking: {}
              }
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();

    const stateValue = actor.getSnapshot().value;

    'green' satisfies typeof stateValue;

    'yellow' satisfies typeof stateValue;

    // @ts-expect-error compound state
    'red' satisfies typeof stateValue;

    // @ts-expect-error parallel state
    'emergency' satisfies typeof stateValue;

    const _redWalk = { red: 'walk' } satisfies typeof stateValue;
    const _redWait = { red: 'wait' } satisfies typeof stateValue;

    const _redUnknown = {
      // @ts-expect-error
      red: 'unknown'
    } satisfies typeof stateValue;

    const _emergency0 = {
      emergency: {
        main: 'blinking',
        cross: 'blinking'
      }
    } satisfies typeof stateValue;

    const _emergency1 = {
      // @ts-expect-error
      emergency: 'main'
    } satisfies typeof stateValue;

    const _emergency2 = {
      // @ts-expect-error
      emergency: {
        main: 'blinking'
      }
    } satisfies typeof stateValue;

    const _emergency3 = {
      emergency: {
        // @ts-expect-error
        main: 'unknown',
        cross: 'blinking'
      }
    } satisfies typeof stateValue;
  });

  it('state.value is exhaustive', () => {
    const machine = setup({}).createMachine({
      initial: 'green',
      states: {
        green: {},
        yellow: {},
        red: {
          initial: 'walk',
          states: {
            walk: {},
            wait: {},
            stop: {}
          }
        },
        emergency: {
          type: 'parallel',
          states: {
            main: {
              initial: 'blinking',
              states: {
                blinking: {}
              }
            },
            cross: {
              initial: 'blinking',
              states: {
                blinking: {}
              }
            }
          }
        }
      }
    });
    const actor = createActor(machine);
    const { value } = actor.getSnapshot();
    if (value === 'green') {
      // ...
    } else {
      value satisfies 'yellow' | { red: any } | { emergency: any };
      if (value === 'yellow') {
        // ...
      } else {
        value satisfies { red: any } | { emergency: any };
        if ('red' in value) {
          value.red satisfies 'walk' | 'wait' | 'stop';
          // @ts-expect-error
          value.red satisfies 'other';
        } else {
          value satisfies {
            emergency: {
              main: 'blinking';
              cross: 'blinking';
            };
          };
        }
      }
    }
    // Nested state exhaustiveness
    if (typeof value === 'object' && 'red' in value) {
      // @ts-expect-error
      value satisfies 'green';
      // @ts-expect-error
      value satisfies 'red';
      // @ts-expect-error
      value.emergency;
      value.red satisfies 'walk' | 'wait' | 'stop';
    }
    if (
      value !== 'green' &&
      value !== 'yellow' &&
      !('red' in value) &&
      !('emergency' in value)
    ) {
      // Exhaustive check
      value satisfies never;
    }
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

  it('should accept an after transition that references a known delay', () => {
    setup({
      delays: {
        hundred: 100
      }
    }).createMachine({
      initial: 'a',
      states: {
        a: {
          after: {
            hundred: 'b'
          }
        },
        b: {}
      }
    });
  });

  it('should not accept an after transition that references an unknown delay when delays are configured', () => {
    setup({
      delays: {
        thousand: 1000
      }
    }).createMachine({
      initial: 'a',
      states: {
        a: {
          after: {
            // @x-ts-expect-error https://github.com/microsoft/TypeScript/issues/55709
            unknown: 'b'
          }
        },
        b: {}
      }
    });
  });

  it('should not accept an after transition that references an unknown delay when delays are not configured', () => {
    setup({}).createMachine({
      initial: 'a',
      states: {
        a: {
          after: {
            // @x-ts-expect-error https://github.com/microsoft/TypeScript/issues/55709
            unknown: 'b'
          }
        },
        b: {}
      }
    });
  });

  it('should accept a guarded transition that references a known guard', () => {
    setup({
      types: {} as {
        events: { type: 'NEXT' };
      },
      guards: {
        checkStuff: () => true
      }
    }).createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: {
              guard: 'checkStuff',
              target: 'b'
            }
          }
        },
        b: {}
      }
    });
  });

  it('should not accept a guarded transition that references an unknown guard when guards are configured', () => {
    setup({
      types: {} as {
        events: { type: 'NEXT' };
      },
      guards: {
        checkStuff: () => true
      }
    }).createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            // @ts-expect-error
            NEXT: {
              guard: 'unknown',
              target: 'b'
            }
          }
        },
        b: {}
      }
    });
  });

  it('should not accept a guarded transition that references an unknown guard when guards are not configured', () => {
    setup({
      types: {} as {
        events: { type: 'NEXT' };
      }
    }).createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            // @ts-expect-error
            NEXT: {
              guard: 'checkStuff',
              target: 'b'
            }
          }
        },
        b: {}
      }
    });
  });

  it('should accept `enqueueActions` within the config when actions are not configured', () => {
    setup({
      types: {} as {
        events:
          | {
              type: 'SOMETHING';
            }
          | {
              type: 'SOMETHING_ELSE';
            };
      }
    }).createMachine({
      on: {
        SOMETHING: {
          actions: enqueueActions(({ enqueue }) => {
            enqueue.raise({ type: 'SOMETHING_ELSE' });
          })
        }
      }
    });
  });

  it('should accept `enqueueActions` within the config when empty delays are configured', () => {
    setup({
      delays: {}
    }).createMachine({
      entry: enqueueActions(() => {})
    });
  });

  it("should accept `enqueueActions` that doesn't use any other defined actions", () => {
    setup({
      types: {} as {
        events:
          | {
              type: 'SOMETHING';
            }
          | {
              type: 'SOMETHING_ELSE';
            };
      },
      actions: {
        doStuff: enqueueActions(({ enqueue }) => {
          enqueue.raise({ type: 'SOMETHING_ELSE' });
        })
      }
    });
  });

  it('should accept `enqueueActions` that uses a known guard', () => {
    setup({
      types: {} as {
        events:
          | {
              type: 'SOMETHING';
            }
          | {
              type: 'SOMETHING_ELSE';
            };
      },
      actions: {
        doStuff: enqueueActions(({ enqueue, check }) => {
          if (check('checkStuff')) {
            enqueue.raise({ type: 'SOMETHING_ELSE' });
          }
        })
      },
      guards: {
        checkStuff: () => true
      }
    });
  });

  it('should not allow `enqueueActions` to use an unknown guard (when guards are configured)', () => {
    setup({
      types: {} as {
        events:
          | {
              type: 'SOMETHING';
            }
          | {
              type: 'SOMETHING_ELSE';
            };
      },
      actions: {
        doStuff: enqueueActions(({ enqueue, check }) => {
          if (
            check(
              // @ts-expect-error
              'unknown'
            )
          ) {
            enqueue.raise({ type: 'SOMETHING_ELSE' });
          }
        })
      },
      guards: {
        checkStuff: () => true
      }
    });
  });

  it('should not allow `enqueueActions` to use an unknown guard (when guards are not configured)', () => {
    setup({
      types: {} as {
        events:
          | {
              type: 'SOMETHING';
            }
          | {
              type: 'SOMETHING_ELSE';
            };
      },
      actions: {
        doStuff: enqueueActions(({ enqueue, check }) => {
          if (
            check(
              // @ts-expect-error
              'unknown'
            )
          ) {
            enqueue.raise({ type: 'SOMETHING_ELSE' });
          }
        })
      }
    });
  });

  it('should be able to use a parameterized `enqueueActions` action with its required params in the machine', () => {
    setup({
      actions: {
        doStuff: enqueueActions((_, params: number) => {})
      }
    }).createMachine({
      entry: {
        type: 'doStuff',
        params: 0
      }
    });
  });

  it('should not accept a string reference to parameterized `enqueueActions` without its required params in the machine', () => {
    setup({
      actions: {
        doStuff: enqueueActions((_, params: number) => {})
      }
    }).createMachine({
      // @ts-expect-error
      entry: 'doStuff'
    });
  });

  it('should not accept an object reference to parameterized `enqueueActions` without its required params in the machine', () => {
    setup({
      actions: {
        doStuff: enqueueActions((_, params: number) => {})
      }
    }).createMachine({
      // @ts-expect-error
      entry: {
        type: 'doStuff'
      }
    });
  });

  it('should not accept an object reference to parameterized `enqueueActions` without its required params in the machine', () => {
    setup({
      actions: {
        doStuff: enqueueActions((_, params: number) => {})
      }
    }).createMachine({
      // @ts-expect-error
      entry: {
        type: 'doStuff'
      }
    });
  });

  it('should not accept a reference to parameterized `enqueueActions` with wrong params in the machine', () => {
    setup({
      actions: {
        doStuff: enqueueActions((_, params: number) => {})
      }
    }).createMachine({
      // @ts-expect-error
      entry: {
        type: 'doStuff',
        params: 'foo'
      }
    });
  });

  it('should allow `log` action to be configured', () => {
    setup({
      actions: {
        writeDown: log('foo')
      }
    });
  });

  it('should allow `cancel` action to be configured', () => {
    setup({
      actions: {
        revert: cancel('foo')
      }
    });
  });

  it('should allow `stopChild` action to be configured', () => {
    setup({
      actions: {
        releaseFromDuty: stopChild('foo')
      }
    });
  });

  it('EventFrom should work with a machine that has transitions defined on a state', () => {
    // https://github.com/statelyai/xstate/issues/5031

    const machine = setup({
      types: {} as {
        events: {
          type: 'SOME_EVENT';
        };
      }
    }).createMachine({
      id: 'authorization',
      initial: 'loading',
      context: {
        myVar: 'foo'
      },
      states: {
        loaded: {},
        loading: {
          on: {
            SOME_EVENT: {
              target: 'loaded'
            }
          }
        }
      }
    });

    ((_accept: EventFrom<typeof machine>) => {})({ type: 'SOME_EVENT' });
  });

  it('ContextFrom should work with a machine that has transitions defined on a state', () => {
    // https://github.com/statelyai/xstate/issues/5031

    const machine = setup({
      types: {} as {
        context: {
          myVar: string;
        };
      }
    }).createMachine({
      id: 'authorization',
      initial: 'loading',
      context: {
        myVar: 'foo'
      },
      states: {
        loaded: {},
        loading: {
          on: {
            SOME_EVENT: {
              target: 'loaded'
            }
          }
        }
      }
    });

    ((_accept: ContextFrom<typeof machine>) => {})({ myVar: 'whatever' });
  });
});
