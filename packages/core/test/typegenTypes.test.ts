import {
  assign,
  interpret,
  MachineContext,
  StateMachine
} from '../src/index.ts';
import { fromPromise } from '../src/actors/index.ts';
import { fromCallback } from '../src/actors/index.ts';
import { createMachine } from '../src/Machine.ts';
import { TypegenMeta } from '../src/typegenTypes.ts';

describe('typegen types', () => {
  it('should not require implementations when creating machine using `createMachine`', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'fooAction';
        delays: 'barDelay';
        guards: 'bazGuard';
        actors: 'qwertyActor';
      };
    }
    createMachine({
      types: { typegen: {} as TypesMeta }
    });
  });

  it('should limit event type provided to an action', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        actors: never;
      };
      eventsCausingActions: {
        myAction: 'FOO' | 'BAR';
      };
    }

    createMachine(
      {
        context: { foo: 100 },
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        actions: {
          myAction: ({ event }) => {
            event.type === 'FOO';
            event.type === 'BAR';
            // @ts-expect-error
            event.type === 'BAZ';
          }
        }
      }
    );
  });

  it('should limit event type provided to a delay', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        actors: never;
      };
      eventsCausingDelays: {
        myDelay: 'FOO' | 'BAR';
      };
    }

    createMachine(
      {
        context: { foo: 100 },
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        delays: {
          myDelay: ({ event }) => {
            event.type === 'FOO';
            event.type === 'BAR';
            // @ts-expect-error
            event.type === 'BAZ';

            return 42;
          }
        }
      }
    );
  });

  it('should limit event type provided to a guard', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        actors: never;
      };
      eventsCausingGuards: {
        myGuard: 'FOO' | 'BAR';
      };
    }

    createMachine(
      {
        context: { foo: 100 },
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        guards: {
          myGuard: ({ event }) => {
            event.type === 'FOO';
            event.type === 'BAR';
            // @ts-expect-error
            event.type === 'BAZ';

            return true;
          }
        }
      }
    );
  });

  it('should limit event type provided to an actor', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        actors: never;
      };
      eventsCausingActors: {
        myActor: 'FOO' | 'BAR';
      };
    }

    createMachine(
      {
        context: { foo: 100 },
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        actors: {
          // TODO: add test for input?
          myActor: fromPromise(({ input }) => {
            input.type === 'FOO';
            input.type === 'BAR';
            // @x-ts-expect-error TODO: strongly type inputs for promise
            input.type === 'BAZ';

            return Promise.resolve(42);
          })
        }
      }
    );
  });

  it('should not allow an unknown action', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        actors: never;
      };
      eventsCausingActions: {
        myAction: 'FOO' | 'BAR';
      };
    }

    createMachine(
      {
        context: { foo: 100 },
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        actions: {
          // @ts-expect-error
          unknownAction: () => {}
        }
      }
    );
  });

  it('should not allow an unknown delay', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        actors: never;
      };
      eventsCausingDelays: {
        myDelay: 'FOO' | 'BAR';
      };
    }

    createMachine(
      {
        context: { foo: 100 },
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        delays: {
          // @ts-expect-error
          unknownDelay: () => 42
        }
      }
    );
  });

  it('should not allow an unknown guard', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        actors: never;
      };
      eventsCausingGuards: {
        myGuard: 'FOO' | 'BAR';
      };
    }

    createMachine(
      {
        context: { foo: 100 },
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        guards: {
          // @ts-expect-error
          unknownGuard: () => true
        }
      }
    );
  });

  it('should not allow an unknown actor', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        actors: never;
      };
      eventsCausingActors: {
        myActor: 'FOO' | 'BAR';
      };
    }

    createMachine(
      {
        context: { foo: 100 },
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        actors: {
          // @ts-expect-error
          unknownActor: () => () => {}
        }
      }
    );
  });

  it('should allow valid string `matches`', () => {
    interface TypesMeta extends TypegenMeta {
      matchesStates: 'a' | 'b' | 'c';
    }

    const machine = createMachine({
      context: { foo: 100 },
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      },
      initial: 'a',
      states: {
        a: {}
      }
    });

    machine.initialState.matches('a');
  });

  it('should allow valid object `matches`', () => {
    interface TypesMeta extends TypegenMeta {
      matchesStates: 'a' | { a: 'b' } | { a: 'c' };
    }

    const machine = createMachine({
      types: { typegen: {} as TypesMeta },
      context: { foo: 100 },
      initial: 'a',
      states: {
        a: {}
      }
    });

    machine.initialState.matches({ a: 'c' });
  });

  it('should not allow invalid string `matches`', () => {
    interface TypesMeta extends TypegenMeta {
      matchesStates: 'a' | 'b' | 'c';
    }

    const machine = createMachine({
      context: { foo: 100 },
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      },
      initial: 'a',
      states: {
        a: {}
      }
    });

    // @ts-expect-error
    machine.initialState.matches('d');
  });

  it('should not allow invalid object `matches`', () => {
    interface TypesMeta extends TypegenMeta {
      matchesStates: 'a' | { a: 'b' } | { a: 'c' };
    }

    const machine = createMachine({
      types: { typegen: {} as TypesMeta },
      context: { foo: 100 },
      initial: 'a',
      states: {
        a: {}
      }
    });

    // @ts-expect-error
    machine.initialState.matches({ a: 'd' });
  });

  it('should allow a valid tag with `hasTag`', () => {
    interface TypesMeta extends TypegenMeta {
      tags: 'a' | 'b' | 'c';
    }

    const machine = createMachine({
      context: { foo: 100 },
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      },
      initial: 'a',
      states: {
        a: {}
      }
    });

    machine.initialState.hasTag('a');
  });

  it('should not allow an invalid tag with `hasTag`', () => {
    interface TypesMeta extends TypegenMeta {
      tags: 'a' | 'b' | 'c';
    }

    const machine = createMachine({
      context: { foo: 100 },
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      },
      initial: 'a',
      states: {
        a: {}
      }
    });

    // @ts-expect-error
    machine.initialState.hasTag('d');
  });

  it('`withConfig` should require all missing implementations ', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: 'myDelay';
        guards: never;
        actors: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
        myDelay: 'BAR';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    // @ts-expect-error
    machine.provide({});
    machine.provide({
      // @ts-expect-error
      actions: {}
    });
    // @ts-expect-error
    machine.provide({
      actions: {
        myAction: () => {}
      }
    });
    machine.provide({
      actions: {
        myAction: () => {}
      },
      delays: {
        myDelay: () => 42
      }
    });
  });

  it('should allow to create an actor out of a machine without any missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        actors: never;
      };
    }

    const machine = createMachine({
      types: { typegen: {} as TypesMeta }
    });

    interpret(machine);
  });

  it('should not allow to create an actor out of a machine with missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: never;
        guards: never;
        actors: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    // TODO: rethink this; should probably be done as a linter rule instead
    // @x-ts-expect-error
    interpret(machine);
  });

  it('should allow to create an actor out of a machine with implementations provided through `withConfig`', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: never;
        guards: never;
        actors: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
      };
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    interpret(
      machine.provide({
        actions: {
          myAction: () => {}
        }
      })
    );
  });

  it('should not require all implementations when creating machine', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'fooAction';
        delays: 'barDelay';
        guards: 'bazGuard';
        actors: 'qwertyActor';
      };
      eventsCausingActions: { fooAction: 'FOO' };
      eventsCausingDelays: { barDelay: 'BAR' };
      eventsCausingGuards: { bazGuard: 'BAR' };
      eventsCausingActors: { qwertyActor: 'BAR' };
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        actions: {
          fooAction: () => {}
        }
      }
    );
  });

  it('should allow to override already provided implementation using `withConfig`', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'fooAction';
        delays: never;
        guards: never;
        actors: never;
      };
      eventsCausingActions: { fooAction: 'FOO' };
      eventsCausingDelays: { barDelay: 'BAR' };
    }

    const machine = createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        delays: {
          barDelay: () => 42
        }
      }
    );

    machine.provide({
      actions: {
        fooAction: () => {}
      },
      delays: {
        barDelay: () => 100
      }
    });
  });

  it('should include init event in the provided parameter type if necessary', () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingActions: {
        myAction: 'xstate.init';
      };
      internalEvents: {
        'xstate.init': { type: 'xstate.init' };
      };
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' }
        }
      },
      {
        actions: {
          myAction: ({ event }) => {
            event.type === 'xstate.init';
          }
        }
      }
    );
  });

  it('should include generated dynamic internal event in the provided parameter if types.actors is not provided', () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingActions: {
        myAction: 'done.invoke.myActor' | 'FOO';
      };
      internalEvents: {
        'done.invoke.myActor': {
          type: 'done.invoke.myActor';
          output: unknown;
          __tip: 'Declare the type.';
        };
      };
      invokeSrcNameMap: {
        myActor: 'done.invoke.myActor';
      };
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' }
        }
      },
      {
        actions: {
          myAction: ({ event }) => {
            if (event.type === 'FOO') {
              return;
            }
            event.type === 'done.invoke.myActor';
            event.output;
            // indirectly check that it's not any
            // @ts-expect-error
            ((_accept: string) => {})(event.output);
          }
        }
      }
    );
  });

  it('should use an event generated based on types.actors for a dynamic internal event over the generated fallback', () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingActions: {
        myAction: 'done.invoke.myActor' | 'FOO';
      };
      internalEvents: {
        'done.invoke.myActor': {
          type: 'done.invoke.myActor';
          output: unknown;
          __tip: 'Declare the type.';
        };
      };
      invokeSrcNameMap: {
        myActor: 'done.invoke.myActor';
      };
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' },
          actors: {} as {
            src: any;
            output: string;
            id: 'myActor';
          }
        }
      },
      {
        actions: {
          myAction: ({ event }) => {
            if (event.type === 'FOO') {
              return;
            }
            event.type === 'done.invoke.myActor';
            event.output;
            ((_accept: string) => {})(event.output);
          }
        }
      }
    );
  });

  it('should allow a promise actor returning the explicitly declared data in the given types.actors', () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingActors: {
        myActor: 'FOO';
      };
      internalEvents: {
        'done.invoke.myActor': {
          type: 'done.invoke.myActor';
          output: unknown;
          __tip: 'Declare the type.';
        };
      };
      invokeSrcNameMap: {
        myActor: 'done.invoke.myActor';
      };
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' },
          actors: {
            myActor: {
              output: {} as string
            }
          }
        }
      },
      {
        actors: {
          myActor: fromPromise(() => Promise.resolve('foo'))
        }
      }
    );
  });

  it('should not allow a promise actor returning a different type than the explicitly declared one in the given types.actors', () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingActors: {
        myActor: 'FOO';
      };
      internalEvents: {
        'done.invoke.myActor': {
          type: 'done.invoke.myActor';
          output: unknown;
          __tip: 'Declare the type.';
        };
      };
      invokeSrcNameMap: {
        myActor: 'done.invoke.myActor';
      };
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' },
          actors: {
            myActor: {
              output: {} as string
            }
          }
        }
      },
      {
        actors: {
          // @ts-expect-error
          myActor: () => Promise.resolve(42)
        }
      }
    );
  });

  it('should allow a machine actor returning the explicitly declared output in the given types.actors', () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingActors: {
        myActor: 'FOO';
      };
      internalEvents: {
        'done.invoke.myActor': {
          type: 'done.invoke.myActor';
          output: unknown;
          __tip: 'Declare the type.';
        };
      };
      invokeSrcNameMap: {
        myActor: 'done.invoke.myActor';
      };
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' },
          actors: {
            myActor: {
              output: {} as { foo: string }
            }
          }
        }
      },
      {
        actors: {
          myActor: createMachine<{ foo: string }>({})
        }
      }
    );
  });

  // it('should not allow a machine actor returning a different type than the explicitly declared one in the given types.actors', () => {
  //   interface TypesMeta extends TypegenMeta {
  //     eventsCausingActors: {
  //       myActor: 'FOO';
  //     };
  //     internalEvents: {
  //       'done.invoke.myActor': {
  //         type: 'done.invoke.myActor';
  //         output: unknown;
  //         __tip: 'Declare the type.';
  //       };
  //     };
  //     invokeSrcNameMap: {
  //       myActor: 'done.invoke.myActor';
  //     };
  //   }

  //   createMachine(
  //     {
  //       tsTypes: {} as TypesMeta,
  //       schema: {
  //         events: {} as { type: 'FOO' },
  //         actors: {
  //           myActor: {
  //             output: {} as { foo: string }
  //           }
  //         }
  //       }
  //     },
  //     {
  //       actors: {
  //         // @ts-expect-error
  //         myActor: () => (createMachine<{ foo: number }>({}))
  //       }
  //     }
  //   );
  // });

  it('should infer an action object with narrowed event type', () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingActions: {
        actionName: 'BAR';
      };
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR'; value: string }
        }
      },
      {
        actions: {
          actionName: assign(({ event }) => {
            ((_accept: 'BAR') => {})(event.type);
            return {};
          })
        }
      }
    );
  });

  it('should accept a machine as an actor', () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingActors: {
        fooActor: 'FOO';
      };
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR'; value: string }
        }
      },
      {
        actors: {
          fooActor: createMachine({})
        }
      }
    );
  });

  // it('should be able to send all of the parent event types back to the parent from an invoked callback', () => {
  //   interface TypesMeta extends TypegenMeta {
  //     eventsCausingActors: {
  //       fooActor: 'FOO';
  //     };
  //   }

  //   createMachine(
  //     {
  //       tsTypes: {} as TypesMeta,
  //       schema: {
  //         events: {} as { type: 'FOO' } | { type: 'BAR' }
  //       }
  //     },
  //     {
  //       actors: {
  //         fooActor: () => fromCallback((send) => {
  //           ((_accept: 'FOO') => {})(event.type);

  //           send({ type: 'BAR' });
  //           send({ type: 'FOO' });
  //           // @ts-expect-error
  //           send({ type: 'BAZ' });
  //         })
  //       }
  //     }
  //   );
  // });

  it("should not provide a loose type for `onReceive`'s argument as a default", () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingActors: {
        fooActor: 'FOO';
      };
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' }
        }
      },
      {
        actors: {
          fooActor: fromCallback((_send, onReceive) => {
            onReceive((event) => {
              ((_accept: string) => {})(event.type);
              // @x-ts-expect-error TODO: determine how to get parent event type here
              event.unknown;
            });
          })
        }
      }
    );
  });

  it("should allow specifying `onReceive`'s argument type manually", () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingActors: {
        fooActor: 'FOO';
      };
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          events: {} as { type: 'FOO' } | { type: 'BAR' }
        }
      },
      {
        actors: {
          fooActor: fromCallback((_send, onReceive) => {
            onReceive((_event: { type: 'TEST' }) => {});
            // @ts-expect-error
            onReceive((_event: { type: number }) => {});
          })
        }
      }
    );
  });

  // it('should error correctly for implementations called in response to internal events when there is no explicit event type', () => {
  //   interface TypesMeta extends TypegenMeta {
  //     eventsCausingActions: {
  //       myAction: 'done.invoke.invocation';
  //     };
  //     eventsCausingActors: {
  //       myInvocation: 'xstate.init';
  //     };
  //     internalEvents: {
  //       'xstate.init': { type: 'xstate.init' };
  //     };
  //     invokeSrcNameMap: {
  //       myInvocation: 'done.invoke.invocation';
  //     };
  //   }

  //   createMachine(
  //     {
  //       tsTypes: {} as TypesMeta,
  //       schema: {
  //         actors: {
  //           myInvocation: {} as {
  //             data: string;
  //           }
  //         }
  //       }
  //     },
  //     {
  //       actors: {
  //         // @ts-expect-error
  //         myInvocation: invokePromise(() => {
  //           return Promise.resolve(1);
  //         })
  //       },
  //       actions: {
  //         myAction: (_context, event) => {
  //           ((_accept: 'done.invoke.invocation') => {})(event.type);
  //           ((_accept: string) => {})(event.output);
  //           // @ts-expect-error
  //           ((_accept: number) => {})(event.output);
  //         }
  //       }
  //     }
  //   );
  // });

  it("shouldn't end up with `any` context after calling `state.matches`", () => {
    interface TypesMeta extends TypegenMeta {
      matchesStates: 'a' | 'b' | 'c';
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
        context: {} as {
          foo: string;
        }
      }
    });

    if (machine.initialState.matches('a')) {
      // @ts-expect-error
      machine.initialState.context.val;
    }
  });

  it("shouldn't end up with `never` within a branch after two `state.matches` calls", () => {
    interface TypesMeta extends TypegenMeta {
      matchesStates: 'a' | 'a.b';
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta,
        context: {} as {
          foo: string;
        }
      }
    });

    const state = machine.initialState;

    if (state.matches('a') && state.matches('a.b')) {
      ((_accept: string) => {})(state.context.foo);
    }
  });

  it('should be possible to pass typegen-less machines to functions expecting a machine argument that do not utilize the typegen information', () => {
    const machine = createMachine({});

    function acceptMachine<
      TContext extends MachineContext,
      TEvent extends { type: string }
    >(machine: StateMachine<TContext, any, TEvent>) {
      return machine;
    }

    acceptMachine(machine);
  });

  it('should error on a provided action where there are no inferred actions', () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingActions: never;
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          context: {} as {
            foo: string;
          }
        }
      },
      {
        // @ts-expect-error
        actions: {
          testAction: () => {}
        }
      }
    );
  });

  it('should error on a provided delay where there are no inferred delays', () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingDelays: never;
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          context: {} as {
            foo: string;
          }
        }
      },
      {
        // @ts-expect-error
        delays: {
          testDelay: () => {}
        }
      }
    );
  });

  it('should error on a provided guard where there are no inferred guards', () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingGuards: never;
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          context: {} as {
            foo: string;
          }
        }
      },
      {
        // @ts-expect-error
        guards: {
          testGuard: () => {}
        }
      }
    );
  });

  it('should error on a provided actor where there are no declared actors', () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingActors: never;
      invokeSrcNameMap: never;
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          context: {} as {
            foo: string;
          }
        }
      },
      {
        // @ts-expect-error
        actors: {
          testActor: () => Promise.resolve(42)
        }
      }
    );
  });

  it('should be able to provide events that use string unions as their type', () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingActions: {
        increment: 'INC';
        decrement: 'DEC';
      };
    }

    createMachine(
      {
        types: {
          typegen: {} as TypesMeta,
          context: {} as {
            count: number;
          },
          events: {} as { type: 'INC' | 'DEC'; value: number }
        }
      },
      {
        actions: {
          increment: assign(({ context, event }) => {
            return {
              count: context.count + event.value
            };
          })
        }
      }
    );
  });
});
