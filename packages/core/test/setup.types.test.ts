import { of } from 'rxjs';
import {
  and,
  assign,
  createMachine,
  fromObservable,
  fromPromise,
  fromTransition,
  not,
  raise,
  sendTo,
  setup,
  spawn
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

  it('should accept a `spawn` action that tries to spawn a known actor', () => {
    setup({
      actors: {
        fetchUser: fromPromise(async () => ({ name: 'Andarist' }))
      },
      actions: {
        spawnFetcher: spawn('fetchUser')
      }
    });
  });

  it('should not accept a `spawn` action that tries to spawn an unknown actor', () => {
    setup({
      actors: {
        fetchUser: fromPromise(async () => ({ name: 'Andarist' }))
      },
      actions: {
        spawnFetcher:
          // @ts-expect-error
          spawn('unknown')
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
});
