import z from 'zod';
import { createActor, createAsyncLogic, setup, types } from '../src/index.ts';
import type {
  IsAny,
  StateFrom,
  StateContextFromStateValue,
  StateSchemaFrom
} from '../src/types.ts';

describe('setup', () => {
  it('setup without schemas should infer context from machine config', () => {
    setup({}).createMachine({
      context: {
        count: 0
      },
      on: {
        INC: ({ context }) => {
          context.count satisfies number;
          return {
            context: {
              count: context.count + 1
            }
          };
        }
      }
    });

    expect(true).toBe(true);
  });

  it('should create a setup object with states', () => {
    const s = setup({
      states: {
        loading: {
          schemas: {
            input: z.object({
              userId: z.string()
            })
          }
        }
      }
    });

    expect(s.states).toEqual({
      loading: {
        schemas: {
          input: expect.any(Object)
        }
      }
    });
  });

  it('should create a setup object with nested state schemas', () => {
    const s = setup({
      states: {
        parent: {
          schemas: {
            input: z.object({
              parentId: z.string()
            })
          },
          states: {
            child: {
              schemas: {
                input: z.object({
                  childId: z.string()
                })
              }
            }
          }
        }
      }
    });

    expect(s.states.parent.states?.child.schemas?.input).toBeDefined();
  });

  it('should create typed state configs from setup', () => {
    const s = setup({
      schemas: {
        context: types<{ count: number }>(),
        events: {
          INC: types<{ value: number }>(),
          RESET: types<{}>()
        },
        tags: types<'active'>(),
        meta: types<{ label: string }>()
      },
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({
              userId: z.string()
            })
          }
        }
      }
    });

    const idle = s.createStateConfig({
      tags: ['active'],
      meta: { label: 'Idle' },
      on: {
        INC: ({ context, event }) => {
          context.count satisfies number;
          event.value satisfies number;

          return {
            context: {
              count: context.count + event.value
            }
          };
        },
        RESET: {
          target: 'loading',
          context: { count: 0 },
          input: { userId: 'user-123' }
        }
      }
    });

    s.createMachine({
      context: { count: 0 },
      initial: 'idle',
      states: {
        idle,
        loading: {}
      }
    });

    expect(idle).toEqual({
      tags: ['active'],
      meta: { label: 'Idle' },
      on: expect.any(Object)
    });
  });

  it('createStateConfig should type a top-level state input by path', () => {
    const s = setup({
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({
              userId: z.string()
            })
          }
        }
      }
    });

    const loading = s.createStateConfig('loading', {
      entry: ({ input }) => {
        input.userId satisfies string;
      }
    });

    s.createMachine({
      initial: 'idle',
      states: {
        idle: {},
        loading
      }
    });

    expect(loading.entry).toEqual(expect.any(Function));
  });

  it('createStateConfig should type a nested state input by dotted path', () => {
    const s = setup({
      states: {
        parent: {
          schemas: {
            input: z.object({ parentId: z.string() })
          },
          states: {
            child: {
              schemas: {
                input: z.object({ childId: z.number() })
              }
            }
          }
        }
      }
    });

    // A nested state config authored standalone, addressed by dotted path.
    const child = s.createStateConfig('parent.child', {
      entry: ({ input }) => {
        input.childId satisfies number;
      }
    });

    // Round-trip: the standalone nested config nests back under its parent,
    // and the parent's own input is typed too.
    const parent = s.createStateConfig('parent', {
      entry: ({ input }) => {
        input.parentId satisfies string;
      },
      initial: {
        target: 'child',
        input: { childId: 42 }
      },
      states: {
        child
      }
    });

    s.createMachine({
      initial: {
        target: 'parent',
        input: { parentId: 'p1' }
      },
      states: {
        parent
      }
    });

    expect(parent.states.child).toBe(child);
  });

  it('createStateConfig should reject invalid paths and mistyped input', () => {
    const s = setup({
      states: {
        idle: {},
        parent: {
          states: {
            child: {
              schemas: {
                input: z.object({ childId: z.number() })
              }
            }
          }
        }
      }
    });

    s.createStateConfig(
      // @ts-expect-error - unknown top-level state path
      'missing',
      {}
    );

    s.createStateConfig(
      // @ts-expect-error - unknown nested state path
      'parent.missing',
      {}
    );

    s.createStateConfig('parent.child', {
      entry: ({ input }) => {
        // @ts-expect-error - childId is a number, not a string
        input.childId satisfies string;
      }
    });

    expect(true).toBe(true);
  });

  // The (path, config) overload validates bare on/always transition targets
  // against the resolved state's SIBLINGS — the children of the path's parent,
  // or the root states for a top-level path — because a bare target resolves
  // relative to the PARENT. These tests guard that: a real sibling is accepted;
  // a child or unknown target is rejected.
  it('createStateConfig should validate (path, config) branch-state transition targets against siblings, not children', () => {
    const s = setup({
      schemas: {
        events: {
          GO: types<{}>()
        }
      },
      states: {
        parent: {
          states: {
            child: {
              states: {
                gc1: {}
              }
            },
            sibling: {}
          }
        }
      }
    });

    // 'sibling' is a real sibling of 'child' (both children of 'parent'), so a
    // bare target to it is valid.
    s.createStateConfig('parent.child', {
      on: {
        GO: {
          target: 'sibling'
        }
      }
    });

    // 'gc1' is a CHILD of 'child', not a sibling. A bare target should be
    // rejected (it would require descendant syntax '.gc1').
    s.createStateConfig('parent.child', {
      on: {
        // @ts-expect-error - 'gc1' is a child, not a sibling; needs '.gc1'
        GO: {
          target: 'gc1'
        }
      }
    });

    expect(true).toBe(true);
  });

  // KNOWN SOUNDNESS GAP: in a parallel state, targeting a sibling region
  // (e.g. `target: 'r2'` from inside `r1`) type-checks but is a runtime no-op.
  // There is no way to tell whether a state is parallel from the setup `states`
  // schema alone, so sibling regions are indistinguishable from ordinary
  // siblings. Tripwire: when `target: 'r2'` stops compiling, the gap is
  // fixed — flip that line to a `@ts-expect-error`.
  it('createStateConfig (path, config) currently accepts a sibling-region target in a parallel state (known limitation)', () => {
    const s = setup({
      schemas: {
        events: {
          E: types<{}>()
        }
      },
      states: {
        p: {
          states: {
            r1: {},
            r2: {}
          }
        }
      }
    });

    s.createStateConfig('p.r1', {
      on: {
        E: {
          target: 'r2' // known gap: should be rejected; flip to @ts-expect-error when it is
        }
      }
    });

    expect(true).toBe(true);
  });

  it('should create typed machines from setup schemas', () => {
    const s = setup({
      schemas: {
        context: types<{ count: number }>(),
        events: {
          INC: types<{ value: number }>()
        }
      }
    });

    s.createMachine({
      context: { count: 0 },
      on: {
        INC: ({ context, event }) => {
          context.count satisfies number;
          event.value satisfies number;

          return {
            context: {
              count: context.count + event.value
            }
          };
        }
      }
    });

    s.createMachine({
      context: { count: 0 },
      on: {
        // @ts-expect-error - unknown event
        UNKNOWN: {}
      }
    });

    expect(true).toBe(true);
  });

  it('should type enq in state transition functions', () => {
    setup({
      schemas: {
        context: types<{ count: number }>(),
        events: {
          INC: types<{}>()
        },
        emitted: {
          notify: types<{}>()
        }
      }
    }).createMachine({
      context: { count: 0 },
      initial: 'idle',
      states: {
        idle: {
          on: {
            INC: (_args, enq) => {
              enq.raise({ type: 'INC' });
              enq.emit({ type: 'notify' });

              // @ts-expect-error - unknown event
              enq.raise({ type: 'UNKNOWN' });

              // @ts-expect-error - unknown emitted event
              enq.emit({ type: 'unknown' });
            }
          }
        }
      }
    });

    expect(true).toBe(true);
  });

  it('should allow target-only state transition function returns for compatible context', () => {
    setup({
      schemas: {
        context: types<{ count: number }>(),
        events: {
          NEXT: types<{}>()
        }
      },
      states: {
        idle: {},
        loading: {}
      }
    }).createMachine({
      context: { count: 0 },
      initial: 'idle',
      states: {
        idle: {
          on: {
            NEXT: () => ({
              target: 'loading'
            })
          }
        },
        loading: {}
      }
    });

    expect(true).toBe(true);
  });

  it('should allow partial context patches in transition function returns', () => {
    const machine = setup({
      schemas: {
        context: types<{ a: number; b: number; c: number }>(),
        events: {
          GO: types<{}>()
        }
      }
    }).createMachine({
      context: { a: 1, b: 2, c: 3 },
      initial: 'idle',
      states: {
        idle: {
          on: {
            GO: ({ context }) => ({
              target: 'done',
              context: {
                b: context.b + 1
              }
            })
          }
        },
        done: {}
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'GO' });

    expect(actor.getSnapshot().context).toEqual({ a: 1, b: 3, c: 3 });
  });

  it('should allow partial context patches in root transition function returns', () => {
    const machine = setup({
      schemas: {
        context: types<{ a: number; b: number; c: number }>(),
        events: {
          GO: types<{}>()
        }
      },
      states: {
        idle: {},
        done: {}
      }
    }).createMachine({
      context: { a: 1, b: 2, c: 3 },
      initial: 'idle',
      on: {
        GO: ({ context }) => ({
          target: '.done',
          context: {
            b: context.b + 1
          }
        })
      },
      states: {
        idle: {},
        done: {}
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'GO' });

    expect(actor.getSnapshot().context).toEqual({ a: 1, b: 3, c: 3 });
  });

  it('should allow partial context patches in static transition configs', () => {
    const machine = setup({
      schemas: {
        context: types<{ a: number; b: number; c: number }>(),
        events: {
          GO: types<{}>()
        }
      }
    }).createMachine({
      context: { a: 1, b: 2, c: 3 },
      initial: 'idle',
      states: {
        idle: {
          on: {
            GO: {
              target: 'done',
              context: {
                b: 4
              }
            }
          }
        },
        done: {}
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'GO' });

    expect(actor.getSnapshot().context).toEqual({ a: 1, b: 4, c: 3 });
  });

  it('should reject invalid setup-created state configs', () => {
    const s = setup({
      schemas: {
        context: types<{ count: number }>(),
        events: {
          INC: types<{ value: number }>(),
          RESET: types<{}>()
        },
        tags: types<'active'>(),
        meta: types<{ label: string }>()
      },
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({
              userId: z.string()
            })
          }
        }
      }
    });

    s.createStateConfig({
      on: {
        // @ts-expect-error - unknown event
        UNKNOWN: {}
      }
    });

    s.createStateConfig({
      // @ts-expect-error - unknown tag
      tags: ['inactive']
    });

    s.createStateConfig({
      // @ts-expect-error - meta.label should be a string
      meta: { label: 42 }
    });

    s.createStateConfig({
      on: {
        // @ts-expect-error - loading input should include a string userId
        RESET: () => ({
          target: 'loading',
          context: { count: 0 },
          input: { userId: 42 }
        })
      }
    });
  });

  it('should type setup-defined state keys in machines', () => {
    const s = setup({
      schemas: {
        events: {
          LOAD: types<{}>()
        }
      },
      states: {
        idle: {},
        loading: {}
      }
    });

    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            LOAD: {
              target: 'loading'
            }
          }
        },
        loading: {}
      }
    });

    const idle = s.createStateConfig({
      on: {
        LOAD: {
          target: 'loading'
        }
      }
    });

    const external = s.createStateConfig({
      on: {
        LOAD: {
          target: '#external'
        }
      }
    });

    s.createStateConfig({
      on: {
        LOAD: {
          target: '.child'
        }
      }
    });

    s.createStateConfig({
      on: {
        // @ts-expect-error - target should be a setup-defined sibling, relative target, or state ID
        LOAD: {
          target: 'missing'
        }
      }
    });

    s.createMachine({
      // @ts-expect-error - initial should be a setup-defined state key
      initial: 'missing',
      states: {
        idle: {},
        loading: {}
      }
    });

    s.createMachine({
      initial: {
        // @ts-expect-error - initial target should be a setup-defined state key
        target: 'missing'
      },
      states: {
        idle: {},
        loading: {}
      }
    });

    s.createMachine({
      initial: 'idle',
      states: {
        idle: {},
        loading: {},
        // @ts-expect-error - states should be setup-defined state keys
        missing: {}
      }
    });

    expect(() => {
      s.createMachine({
        initial: 'idle',
        states: {
          idle: {
            on: {
              // @ts-expect-error - target should be a setup-defined sibling, relative target, or state ID
              LOAD: {
                target: 'missing'
              }
            }
          },
          loading: {}
        }
      });
    }).toThrow();

    expect(true).toBe(true);
    expect(idle).toEqual({
      on: {
        LOAD: {
          target: 'loading'
        }
      }
    });
    expect(external).toEqual({
      on: {
        LOAD: {
          target: '#external'
        }
      }
    });
  });

  it('should not treat nested setup states as top-level keys', () => {
    const s = setup({
      schemas: {
        events: {
          LOAD: types<{}>()
        }
      },
      states: {
        foo: {
          states: {
            bar: {},
            baz: {}
          }
        },
        rootSibling: {}
      }
    });

    s.createMachine({
      initial: 'foo',
      states: {
        foo: {
          // @ts-expect-error - nested initial should be a setup-defined child key
          initial: 'asdf',
          states: {
            bar: {},
            baz: {}
          }
        },
        rootSibling: {}
      }
    });

    s.createMachine({
      initial: 'foo',
      states: {
        foo: {
          initial: 'bar',
          states: {
            bar: {},
            baz: {}
          },
          on: {
            LOAD: {
              target: 'rootSibling'
            }
          }
        },
        rootSibling: {}
      }
    });

    s.createMachine({
      // @ts-expect-error - nested state key should not be a top-level initial
      initial: 'bar',
      states: {
        foo: {
          initial: 'bar',
          states: {
            bar: {},
            baz: {}
          }
        },
        rootSibling: {}
      }
    });

    s.createMachine({
      initial: 'foo',
      states: {
        foo: {
          initial: 'bar',
          states: {
            bar: {},
            baz: {},
            // @ts-expect-error - nested state should be setup-defined child key
            qux: {}
          }
        },
        // @ts-expect-error - nested state key should not be a top-level state
        bar: {},
        rootSibling: {}
      }
    });

    s.createMachine({
      initial: 'foo',
      states: {
        foo: {
          initial: 'baz',
          states: {
            bar: {},
            baz: {
              on: {
                LOAD: {
                  target: 'bar'
                }
              }
            }
          }
        },
        rootSibling: {}
      }
    });

    expect(() => {
      s.createMachine({
        initial: 'foo',
        states: {
          foo: {
            initial: 'baz',
            states: {
              bar: {},
              baz: {
                on: {
                  // @ts-expect-error - target should be a local sibling key, relative target, or state ID
                  LOAD: {
                    target: 'rootSibling'
                  }
                }
              }
            }
          },
          rootSibling: {}
        }
      });
    }).toThrow();
  });

  it('should create a machine from setup', () => {
    const s = setup({
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({
              userId: z.string()
            })
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: 'idle',
      states: {
        idle: {},
        loading: {}
      }
    });

    expect(machine).toBeDefined();
    expect(machine.root.initial).toBeDefined();
  });

  it('should allow setup with no config', () => {
    const s = setup();

    const machine = s.createMachine({
      initial: 'idle',
      states: {
        idle: {}
      }
    });

    expect(machine).toBeDefined();
  });

  it('should allow setup with empty states', () => {
    const s = setup({
      states: {}
    });

    const machine = s.createMachine({
      initial: 'idle',
      states: {
        idle: {}
      }
    });

    expect(machine).toBeDefined();
  });

  it('should preserve schemas.input for multiple states', () => {
    const userIdSchema = z.object({ userId: z.string() });
    const nameSchema = z.object({ name: z.string() });

    const s = setup({
      states: {
        loading: { schemas: { input: userIdSchema } },
        creating: { schemas: { input: nameSchema } }
      }
    });

    expect(s.states.loading.schemas?.input).toBe(userIdSchema);
    expect(s.states.creating.schemas?.input).toBe(nameSchema);
  });

  it('entry action should receive input', () => {
    const entryInputs: unknown[] = [];

    const s = setup({
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({
              userId: z.string()
            })
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            LOAD: {
              target: 'loading',
              input: { userId: 'user-123' }
            }
          }
        },
        loading: {
          entry: ({ input }) => {
            entryInputs.push(input);
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'LOAD' });

    expect(entryInputs).toEqual([{ userId: 'user-123' }]);
  });

  it('exit action should receive input', () => {
    const exitInputs: unknown[] = [];

    const s = setup({
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({
              userId: z.string()
            })
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            LOAD: {
              target: 'loading',
              input: { userId: 'user-456' }
            }
          }
        },
        loading: {
          exit: ({ input }) => {
            exitInputs.push(input);
          },
          on: {
            DONE: { target: 'idle' }
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'LOAD' });
    actor.send({ type: 'DONE' });

    expect(exitInputs).toEqual([{ userId: 'user-456' }]);
  });

  it('transition should pass input to target state', () => {
    const receivedInputs: unknown[] = [];

    const s = setup({
      states: {
        idle: {},
        fetching: {
          schemas: {
            input: z.object({
              url: z.string(),
              method: z.enum(['GET', 'POST'])
            })
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            FETCH: {
              target: 'fetching',
              input: { url: '/api/users', method: 'GET' }
            }
          }
        },
        fetching: {
          entry: ({ input }) => {
            receivedInputs.push(input);
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'FETCH' });

    expect(receivedInputs).toEqual([{ url: '/api/users', method: 'GET' }]);
  });

  it('function-syntax transition should compute input from event and context', () => {
    const receivedInputs: unknown[] = [];
    const s = setup({
      schemas: {
        events: {
          FETCH: types<{ url: string }>()
        }
      },
      states: {
        idle: {},
        fetching: {
          schemas: {
            input: z.object({ url: z.string(), token: z.string() })
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: 'idle',
      context: { authToken: 'abc-123' },
      states: {
        idle: {
          on: {
            FETCH: ({ context, event }) => ({
              target: 'fetching',
              input: { url: event.url, token: context.authToken }
            })
          }
        },
        fetching: {
          entry: ({ input }) => {
            receivedInputs.push(input);
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'FETCH', url: '/api/users' });
    expect(receivedInputs).toEqual([{ url: '/api/users', token: 'abc-123' }]);
  });

  it('initial transition should accept input', () => {
    const entryInputs: unknown[] = [];

    const s = setup({
      states: {
        loading: {
          schemas: {
            input: z.object({
              userId: z.string()
            })
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: {
        target: 'loading',
        input: { userId: 'initial-user' }
      },
      states: {
        loading: {
          entry: ({ input }) => {
            entryInputs.push(input);
          }
        }
      }
    });

    createActor(machine).start();

    expect(entryInputs).toEqual([{ userId: 'initial-user' }]);
  });

  it('input can be a function resolving dynamically', () => {
    const entryInputs: unknown[] = [];

    const s = setup({
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({
              userId: z.string(),
              timestamp: z.number()
            })
          }
        }
      }
    });

    const machine = s.createMachine({
      schemas: {
        context: z.object({
          currentUser: z.string()
        })
      },
      initial: 'idle',
      context: { currentUser: 'dynamic-user' } as any,
      states: {
        idle: {
          on: {
            LOAD: {
              target: 'loading',
              input: ({ context }) => ({
                userId: context.currentUser,
                timestamp: 1234567890
              })
            }
          }
        },
        loading: {
          entry: ({ input }, enq) => {
            enq((input) => entryInputs.push(input), input);
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'LOAD' });

    expect(entryInputs).toEqual([
      { userId: 'dynamic-user', timestamp: 1234567890 }
    ]);
  });

  it('nested state should receive input from parent initial', () => {
    const entryInputs: unknown[] = [];

    const s = setup({
      states: {
        parent: {
          states: {
            child: {
              schemas: {
                input: z.object({
                  childValue: z.string()
                })
              }
            }
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: 'parent',
      states: {
        parent: {
          initial: {
            target: 'child',
            input: { childValue: 'nested-param' }
          },
          states: {
            child: {
              entry: ({ input }, enq) => {
                enq((input) => entryInputs.push(input), input);
              }
            }
          }
        }
      }
    });

    createActor(machine).start();

    expect(entryInputs).toEqual([{ childValue: 'nested-param' }]);
  });

  it('should correctly type input in nested states', () => {
    const s = setup({
      states: {
        idle: {},
        active: {
          schemas: {
            input: z.object({ activeId: z.number() })
          },
          states: {
            loading: {
              schemas: {
                input: z.object({ loadingUrl: z.string() })
              }
            },
            ready: {}
          }
        }
      }
    });

    // Type test: input should be typed correctly for each state
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          entry: ({ input }) => {
            input satisfies undefined;
            // @ts-expect-error - input should be undefined, not string
            input satisfies string;
          }
        },
        active: {
          initial: 'loading',
          entry: ({ input }) => {
            input satisfies { activeId: number } | undefined;
            // @ts-expect-error - activeId should be number, not string
            input satisfies { activeId: string };
          },
          states: {
            loading: {
              entry: ({ input }) => {
                input satisfies { loadingUrl: string } | undefined;
                // @ts-expect-error - loadingUrl should be string, not number
                input satisfies { loadingUrl: number };
              }
            },
            ready: {
              entry: ({ input }) => {
                input satisfies undefined;
                // @ts-expect-error - input should be undefined, not object
                input satisfies { foo: string };
              }
            }
          }
        }
      }
    });

    expect(true).toBe(true);
  });

  it('input should be accessible in snapshot via getInputs()', () => {
    const s = setup({
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({
              userId: z.string()
            })
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            LOAD: {
              target: 'loading',
              input: { userId: 'snapshot-user' }
            }
          }
        },
        loading: {}
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'LOAD' });

    const snapshot = actor.getSnapshot();
    const inputs = snapshot.getInputs();

    // Inputs are keyed by state node ID
    expect(inputs['(machine).loading']).toEqual({ userId: 'snapshot-user' });
  });

  it('nested state input should be accessible in snapshot', () => {
    const s = setup({
      states: {
        parent: {
          schemas: {
            input: z.object({ parentId: z.string() })
          },
          states: {
            child: {
              schemas: {
                input: z.object({ childId: z.number() })
              }
            }
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: {
        target: 'parent',
        input: { parentId: 'p1' }
      },
      states: {
        parent: {
          initial: {
            target: 'child',
            input: { childId: 42 }
          },
          states: {
            child: {}
          }
        }
      }
    });

    const actor = createActor(machine).start();
    const snapshot = actor.getSnapshot();
    const inputs = snapshot.getInputs();

    expect(inputs['(machine).parent']).toEqual({ parentId: 'p1' });
    expect(inputs['(machine).parent.child']).toEqual({ childId: 42 });
  });

  it('getInputs() should be strongly typed', () => {
    const s = setup({
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({ userId: z.string() })
          }
        },
        active: {
          schemas: {
            input: z.object({ sessionId: z.number() })
          },
          states: {
            running: {
              schemas: {
                input: z.object({ taskId: z.string() })
              }
            }
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: 'idle',
      states: {
        idle: {},
        loading: {},
        active: {
          initial: 'running',
          states: {
            running: {}
          }
        }
      }
    });

    const actor = createActor(machine).start();
    const inputs = actor.getSnapshot().getInputs();

    // Type tests for getInputs() return type
    inputs['(machine).idle'] satisfies undefined;
    inputs['(machine).loading'] satisfies { userId: string } | undefined;
    inputs['(machine).active'] satisfies { sessionId: number } | undefined;
    inputs['(machine).active.running'] satisfies { taskId: string } | undefined;

    // @ts-expect-error - loading input should have userId string, not number
    inputs['(machine).loading'] satisfies { userId: number };
    // @ts-expect-error - active input should have sessionId number, not string
    inputs['(machine).active'] satisfies { sessionId: string };

    expect(true).toBe(true);
  });

  it('input should persist across self-transitions', () => {
    const s = setup({
      states: {
        active: {
          schemas: {
            input: z.object({ count: z.number() })
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: {
        target: 'active',
        input: { count: 1 }
      },
      states: {
        active: {
          on: {
            // Self-transition without reenter
            PING: {}
          }
        }
      }
    });

    const actor = createActor(machine).start();

    // Input should be set initially
    expect(actor.getSnapshot().getInputs()['(machine).active']).toEqual({
      count: 1
    });

    // Send event that triggers self-transition
    actor.send({ type: 'PING' });

    // Input should still be there
    expect(actor.getSnapshot().getInputs()['(machine).active']).toEqual({
      count: 1
    });
  });

  it('invoke transitions should require context for incompatible targets', () => {
    const s = setup({
      schemas: {
        context: types<{}>(),
        events: {
          GO: types<{}>()
        }
      },
      states: {
        idle: {},
        loading: {},
        success: {
          schemas: {
            context: z.object({ message: z.string() })
          }
        }
      },
      actorSources: {
        load: createAsyncLogic({
          run: async () => 'Done' as const
        })
      }
    });

    s.createMachine({
      context: {},
      initial: 'idle',
      states: {
        idle: {
          on: {
            GO: { target: 'loading' }
          }
        },
        loading: {
          // @ts-expect-error - success context requires a message
          invoke: {
            src: 'load',
            onDone: () => ({ target: 'success' })
          }
        },
        success: {}
      }
    });

    s.createMachine({
      context: {},
      initial: 'idle',
      states: {
        idle: {
          on: {
            GO: { target: 'loading' }
          }
        },
        loading: {
          // @ts-expect-error - success context requires a message
          invoke: {
            src: 'load',
            onError: () => ({ target: 'success' })
          }
        },
        success: {}
      }
    });

    s.createMachine({
      context: {},
      initial: 'idle',
      states: {
        idle: {
          on: {
            GO: { target: 'loading' }
          }
        },
        loading: {
          // @ts-expect-error - success context requires a message
          invoke: {
            src: 'load',
            onSnapshot: () => ({ target: 'success' })
          }
        },
        success: {}
      }
    });

    s.createMachine({
      context: {},
      initial: 'idle',
      states: {
        idle: {
          on: {
            GO: { target: 'loading' }
          }
        },
        loading: {
          // @ts-expect-error - success context requires a message
          invoke: {
            src: 'load',
            timeout: 100,
            onTimeout: () => ({ target: 'success' })
          }
        },
        success: {}
      }
    });

    s.createMachine({
      context: {},
      initial: 'idle',
      states: {
        idle: {
          on: {
            GO: { target: 'loading' }
          }
        },
        loading: {
          invoke: {
            src: 'load',
            timeout: 100,
            onDone: ({ event }) => {
              event.output satisfies 'Done';
              // @ts-expect-error - output should be inferred from actor logic
              event.output satisfies number;
              return {
                target: 'success',
                context: { message: event.output }
              };
            },
            onError: ({ event }) => ({
              target: 'success',
              context: { message: event.actorId }
            }),
            onSnapshot: () => ({
              target: 'success',
              context: { message: 'Snapshot' }
            }),
            onTimeout: () => ({
              target: 'success',
              context: { message: 'Timeout' }
            })
          }
        },
        success: {}
      }
    });

    expect(true).toBe(true);
  });

  it('state context schemas should narrow context in state actions', () => {
    const s = setup({
      states: {
        idle: {
          schemas: {
            context: z.object({ user: z.null() })
          }
        },
        success: {
          schemas: {
            context: z.object({ user: z.string() })
          }
        }
      }
    });

    s.createMachine({
      schemas: {
        context: z.object({ user: z.string().nullable() }),
        events: {
          LOAD: z.object({})
        }
      },
      initial: 'idle',
      context: { user: null },
      states: {
        idle: {
          entry: ({ context }) => {
            context.user satisfies null;
            // @ts-expect-error
            context.user satisfies string;
          },
          on: {
            LOAD: () => ({
              target: 'success',
              context: { user: 'Ada' }
            })
          }
        },
        success: {
          entry: ({ context }) => {
            context.user satisfies string;
            // @ts-expect-error - success context should not be nullable
            context.user satisfies null;
          }
        }
      }
    });

    const machine = s.createMachine({
      schemas: {
        context: z.object({ user: z.string().nullable() }),
        events: {
          LOAD: z.object({})
        }
      },
      initial: 'idle',
      context: { user: null },
      states: {
        idle: {
          on: {
            LOAD: {
              target: 'success',
              context: { user: 'Ada' }
            }
          }
        },
        success: {}
      }
    });

    type SuccessContext = StateContextFromStateValue<
      StateSchemaFrom<typeof machine>,
      { user: string | null },
      'success'
    >;
    (({}) as SuccessContext).user satisfies string;
    // @ts-expect-error - success context should not be nullable
    (({}) as SuccessContext).user satisfies null;

    const actor = createActor(machine).start();

    actor.send({ type: 'LOAD' });

    const snapshot = actor.getSnapshot();

    if (snapshot.matches('success')) {
      snapshot.context.user satisfies string;
      // @ts-expect-error - matched success context should not be nullable
      snapshot.context.user satisfies null;
    }
    expect(true).toBe(true);
  });

  it('snapshot matches should allow chained checks for states sharing the same context', () => {
    const sameContextMachine = setup({
      states: {
        Loading: {},
        InvalidRoute: {},
        Ready: {
          schemas: {
            context: types<{ data: 'value' }>()
          }
        }
      }
    }).createMachine({
      initial: 'Loading',
      states: {
        Loading: {},
        InvalidRoute: {},
        Ready: {}
      }
    });

    type SameContextSnapshot = StateFrom<typeof sameContextMachine>;
    type SameContextValue = SameContextSnapshot['value'];
    false satisfies IsAny<SameContextValue>;
    'Ready' satisfies SameContextValue;
    // @ts-expect-error - unknown states should not be part of this machine's state value
    'Other' satisfies SameContextValue;

    function chainedSameContext(snapshot: SameContextSnapshot) {
      if (snapshot.matches('Loading') || snapshot.matches('InvalidRoute')) {
        return true;
      }

      snapshot.value satisfies 'Ready';
      type Data = typeof snapshot.context.data;
      false satisfies IsAny<Data>;
      snapshot.context.data satisfies 'value';

      return snapshot.context.data;
    }

    chainedSameContext(
      sameContextMachine.resolveState({
        value: 'Ready',
        context: { data: 'value' }
      }) as SameContextSnapshot
    );
    expect(true).toBe(true);
  });

  it('snapshot matches should narrow context for nested state values', () => {
    const nestedMachine = setup({
      states: {
        Flow: {
          states: {
            Loading: {},
            InvalidRoute: {},
            Ready: {
              schemas: {
                context: types<{ data: 'nested-value' }>()
              }
            }
          }
        }
      }
    }).createMachine({
      initial: 'Flow',
      states: {
        Flow: {
          initial: 'Loading',
          states: {
            Loading: {},
            InvalidRoute: {},
            Ready: {}
          }
        }
      }
    });

    type NestedSnapshot = StateFrom<typeof nestedMachine>;
    type NestedValue = NestedSnapshot['value'];
    false satisfies IsAny<NestedValue>;
    ({ Flow: 'Ready' }) satisfies NestedValue;
    // @ts-expect-error - unknown nested states should not be part of this machine's state value
    ({ Flow: 'Other' }) satisfies NestedValue;

    function nestedReady(snapshot: NestedSnapshot) {
      if (snapshot.matches({ Flow: 'Ready' })) {
        snapshot.value satisfies { Flow: 'Ready' };
        type Data = typeof snapshot.context.data;
        false satisfies IsAny<Data>;
        snapshot.context.data satisfies 'nested-value';

        return snapshot.context.data;
      }

      return true;
    }

    nestedReady(
      nestedMachine.resolveState({
        value: { Flow: 'Ready' },
        context: { data: 'nested-value' }
      }) as NestedSnapshot
    );
    expect(true).toBe(true);
  });

  it('state context schemas should require context for incompatible targets', () => {
    const s = setup({
      states: {
        idle: {
          schemas: {
            context: z.object({ count: z.number(), user: z.null() })
          }
        },
        success: {
          schemas: {
            context: z.object({ count: z.number(), user: z.string() })
          }
        }
      }
    });

    s.createMachine({
      schemas: {
        context: z.object({
          count: z.number(),
          user: z.string().nullable()
        }),
        events: {
          LOAD: z.object({})
        }
      },
      initial: 'idle',
      context: { count: 0, user: null },
      states: {
        idle: {
          on: {
            // @ts-expect-error - success context requires a string user
            LOAD: () => ({
              target: 'success'
            })
          }
        },
        success: {}
      }
    });

    s.createMachine({
      schemas: {
        context: z.object({
          count: z.number(),
          user: z.string().nullable()
        }),
        events: {
          LOAD: z.object({})
        }
      },
      initial: 'idle',
      context: { count: 0, user: null },
      states: {
        idle: {
          on: {
            // @ts-expect-error - success context requires a string user
            LOAD: () => ({
              target: 'success',
              context: { count: 1 }
            })
          }
        },
        success: {}
      }
    });

    s.createMachine({
      schemas: {
        context: z.object({
          count: z.number(),
          user: z.string().nullable()
        }),
        events: {
          LOAD: z.object({})
        }
      },
      initial: 'idle',
      context: { count: 0, user: null },
      states: {
        idle: {
          on: {
            // @ts-expect-error - success context requires a string user
            LOAD: {
              target: 'success'
            }
          }
        },
        success: {}
      }
    });

    s.createMachine({
      schemas: {
        context: z.object({
          count: z.number(),
          user: z.string().nullable()
        }),
        events: {
          LOAD: z.object({})
        }
      },
      initial: 'idle',
      context: { count: 0, user: null },
      states: {
        idle: {
          on: {
            // @ts-expect-error - success context requires a string user
            LOAD: {
              target: 'success',
              context: { count: 1 }
            }
          }
        },
        success: {}
      }
    });

    const machine = s.createMachine({
      schemas: {
        context: z.object({
          count: z.number(),
          user: z.string().nullable()
        }),
        events: {
          LOAD: z.object({})
        }
      },
      initial: 'idle',
      context: { count: 0, user: null },
      states: {
        idle: {
          on: {
            LOAD: {
              target: 'success',
              context: { user: 'Ada' }
            }
          }
        },
        success: {}
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'LOAD' });

    expect(actor.getSnapshot().context).toEqual({ count: 0, user: 'Ada' });
  });

  it('state context schemas should reject target context mismatch', () => {
    const s = setup({
      states: {
        idle: {
          schemas: {
            context: z.object({ user: z.null() })
          }
        },
        success: {
          schemas: {
            context: z.object({ user: z.string() })
          }
        }
      }
    });

    s.createMachine({
      schemas: {
        context: z.object({ user: z.string().nullable() }),
        events: {
          LOAD: z.object({})
        }
      },
      initial: 'idle',
      context: { user: null },
      states: {
        idle: {
          on: {
            // @ts-expect-error - success context requires a string user
            LOAD: () => ({
              target: 'success',
              context: { user: null }
            })
          }
        },
        success: {}
      }
    });

    expect(true).toBe(true);
  });
});

describe('required input on transitions', () => {
  // Restore console.warn (and any other) spies after every test so a spy
  // installed by a runtime test can't leak into a later test if an assertion
  // throws before that test's manual restore runs.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Each negative (@ts-expect-error) case is paired with a positive twin identical
  // except for `input`; the twin compiling clean proves the error is caused
  // specifically by the missing input, not something unrelated.
  it('`on` transition to an input-schema sibling requires input', () => {
    const s = setup({
      schemas: {
        events: {
          LOAD: z.object({})
        }
      },
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({ userId: z.string() })
          }
        }
      }
    });

    // NEGATIVE: omitting `input` on a transition to an input-schema sibling errors.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            // @ts-expect-error - target `loading` declares schemas.input, so input is required
            LOAD: {
              target: 'loading'
            }
          }
        },
        loading: {}
      }
    });

    // POSITIVE TWIN: identical except it supplies a valid `input` — must compile clean.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            LOAD: {
              target: 'loading',
              input: { userId: 'user-1' }
            }
          }
        },
        loading: {}
      }
    });

    expect(true).toBe(true);
  });

  it('`on` transition rejects a wrong-shaped input', () => {
    const s = setup({
      schemas: {
        events: {
          LOAD: z.object({})
        }
      },
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({ userId: z.string() })
          }
        }
      }
    });

    // NEGATIVE: `userId` must be a string, not a number.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            // @ts-expect-error - loading input requires userId: string, not number
            LOAD: {
              target: 'loading',
              input: { userId: 123 }
            }
          }
        },
        loading: {}
      }
    });

    // POSITIVE TWIN: correct input shape — must compile clean.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            LOAD: {
              target: 'loading',
              input: { userId: 'user-1' }
            }
          }
        },
        loading: {}
      }
    });

    expect(true).toBe(true);
  });

  it('function-syntax transition return requires input', () => {
    const s = setup({
      schemas: {
        events: {
          LOAD: z.object({})
        }
      },
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({ userId: z.string() })
          }
        }
      }
    });

    // NEGATIVE: function-syntax return omitting `input` errors.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            // @ts-expect-error - returned transition to `loading` requires input
            LOAD: () => ({
              target: 'loading'
            })
          }
        },
        loading: {}
      }
    });

    // POSITIVE TWIN: function-syntax return supplying valid `input` — must compile clean.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            LOAD: () => ({
              target: 'loading',
              input: { userId: 'user-1' }
            })
          }
        },
        loading: {}
      }
    });

    expect(true).toBe(true);
  });

  it('`always` transition requires input', () => {
    const s = setup({
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({ userId: z.string() })
          }
        }
      }
    });

    // NEGATIVE: eventless `always` transition omitting `input` errors.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          // @ts-expect-error - always target `loading` requires input
          always: {
            target: 'loading'
          }
        },
        loading: {}
      }
    });

    // POSITIVE TWIN: `always` supplying valid `input` — must compile clean.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          always: {
            target: 'loading',
            input: { userId: 'user-1' }
          }
        },
        loading: {}
      }
    });

    expect(true).toBe(true);
  });

  it('`after` delayed transition requires input', () => {
    const s = setup({
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({ userId: z.string() })
          }
        }
      }
    });

    // NEGATIVE: delayed `after` transition omitting `input` errors.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          after: {
            // @ts-expect-error - after target `loading` requires input
            1000: {
              target: 'loading'
            }
          }
        },
        loading: {}
      }
    });

    // POSITIVE TWIN: `after` supplying valid `input` — must compile clean.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          after: {
            1000: {
              target: 'loading',
              input: { userId: 'user-1' }
            }
          }
        },
        loading: {}
      }
    });

    expect(true).toBe(true);
  });

  it('state-level `onTimeout` transition requires input', () => {
    const s = setup({
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({ userId: z.string() })
          }
        }
      }
    });

    // NEGATIVE: `onTimeout` transition omitting `input` errors.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          timeout: 1000,
          // @ts-expect-error - onTimeout target `loading` requires input
          onTimeout: {
            target: 'loading'
          }
        },
        loading: {}
      }
    });

    // POSITIVE TWIN: `onTimeout` supplying valid `input` — must compile clean.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          timeout: 1000,
          onTimeout: {
            target: 'loading',
            input: { userId: 'user-1' }
          }
        },
        loading: {}
      }
    });

    expect(true).toBe(true);
  });

  it('state-level `onDone` transition requires input', () => {
    const s = setup({
      states: {
        work: {
          states: {
            step: {}
          }
        },
        loading: {
          schemas: {
            input: z.object({ userId: z.string() })
          }
        }
      }
    });

    // NEGATIVE: `onDone` transition omitting `input` errors.
    s.createMachine({
      initial: 'work',
      states: {
        work: {
          initial: 'step',
          states: {
            step: { type: 'final' }
          },
          // @ts-expect-error - onDone target `loading` requires input
          onDone: {
            target: 'loading'
          }
        },
        loading: {}
      }
    });

    // POSITIVE TWIN: `onDone` supplying valid `input` — must compile clean.
    s.createMachine({
      initial: 'work',
      states: {
        work: {
          initial: 'step',
          states: {
            step: { type: 'final' }
          },
          onDone: {
            target: 'loading',
            input: { userId: 'user-1' }
          }
        },
        loading: {}
      }
    });

    expect(true).toBe(true);
  });

  it('state-level `onError` transition requires input', () => {
    const s = setup({
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({ userId: z.string() })
          }
        }
      }
    });

    // NEGATIVE: `onError` transition omitting `input` errors.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          // @ts-expect-error - onError target `loading` requires input
          onError: {
            target: 'loading'
          }
        },
        loading: {}
      }
    });

    // POSITIVE TWIN: `onError` supplying valid `input` — must compile clean.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          onError: {
            target: 'loading',
            input: { userId: 'user-1' }
          }
        },
        loading: {}
      }
    });

    expect(true).toBe(true);
  });

  it('object-form `initial` to an input-schema target requires input', () => {
    const s = setup({
      states: {
        loading: {
          schemas: {
            input: z.object({ userId: z.string() })
          }
        }
      }
    });

    // NEGATIVE: object-form `initial` omitting `input` errors.
    s.createMachine({
      // @ts-expect-error - initial target `loading` requires input
      initial: {
        target: 'loading'
      },
      states: {
        loading: {}
      }
    });

    // POSITIVE TWIN: object-form `initial` supplying valid `input` — must compile clean.
    s.createMachine({
      initial: {
        target: 'loading',
        input: { userId: 'user-1' }
      },
      states: {
        loading: {}
      }
    });

    expect(true).toBe(true);
  });

  it('out-of-scope and no-schema targets keep input optional', () => {
    const s = setup({
      schemas: {
        events: {
          GO: z.object({})
        }
      },
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({ userId: z.string() })
          }
        }
      }
    });

    // Guard: a bare sibling target to `loading` IS enforced here — proving that
    // `createStateConfig` applies the required-input rule, so the out-of-scope
    // positives below are non-vacuous.
    s.createStateConfig({
      on: {
        // @ts-expect-error - bare sibling target `loading` requires input
        GO: {
          target: 'loading'
        }
      }
    });

    // `#id` target: type system can't correlate to a schema, so input stays optional.
    s.createStateConfig({
      on: {
        GO: {
          target: '#loading'
        }
      }
    });

    // `.child` relative target: input stays optional.
    s.createStateConfig({
      on: {
        GO: {
          target: '.child'
        }
      }
    });

    // array/parallel target: bypasses the per-target union, so input stays optional
    // (documented escape hatch).
    s.createStateConfig({
      on: {
        GO: {
          target: ['loading']
        }
      }
    });

    // no-schema sibling target: `idle` declares no input schema, so input stays optional.
    s.createStateConfig({
      on: {
        GO: {
          target: 'idle'
        }
      }
    });

    // no-target transition: pure context/effect transition, unaffected.
    s.createStateConfig({
      on: {
        GO: {}
      }
    });

    expect(true).toBe(true);
  });

  it('all-optional / empty input schemas still require input', () => {
    const s = setup({
      schemas: {
        events: {
          LOAD: z.object({})
        }
      },
      states: {
        idle: {},
        // empty schema -> output is `{}` (not `undefined`)
        empty: {
          schemas: {
            input: z.object({})
          }
        },
        // all-optional schema -> output is `{ userId?: string }` (not `undefined`)
        allOptional: {
          schemas: {
            input: z.object({ userId: z.string().optional() })
          }
        }
      }
    });

    // NEGATIVE: even an empty-object input schema requires `input`.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            // @ts-expect-error - empty-object input schema still requires input
            LOAD: {
              target: 'empty'
            }
          }
        },
        empty: {},
        allOptional: {}
      }
    });

    // NEGATIVE: an all-optional input schema still requires `input`.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            // @ts-expect-error - all-optional input schema still requires input
            LOAD: {
              target: 'allOptional'
            }
          }
        },
        empty: {},
        allOptional: {}
      }
    });

    // POSITIVE TWINS: supplying `input` (even `{}`) compiles clean.
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            LOAD: {
              target: 'empty',
              input: {}
            }
          }
        },
        empty: {},
        allOptional: {}
      }
    });

    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            LOAD: {
              target: 'allOptional',
              input: {}
            }
          }
        },
        empty: {},
        allOptional: {}
      }
    });

    expect(true).toBe(true);
  });

  it('invoke `onDone`/`onError` transition to an input-schema sibling requires input', () => {
    const s = setup({
      states: {
        loading: {},
        loaded: {
          schemas: {
            input: z.object({ userId: z.string() })
          }
        }
      },
      actorSources: {
        load: createAsyncLogic({
          run: async () => 'Done' as const
        })
      }
    });

    // NEGATIVE: invoke `onDone` targeting an input-schema sibling omits `input`.
    s.createMachine({
      initial: 'loading',
      states: {
        loading: {
          // @ts-expect-error - onDone target `loaded` requires input
          invoke: {
            src: 'load',
            onDone: {
              target: 'loaded'
            }
          }
        },
        loaded: {}
      }
    });

    // POSITIVE TWIN: invoke `onDone` supplying valid `input` — must compile clean.
    s.createMachine({
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: 'load',
            onDone: {
              target: 'loaded',
              input: { userId: 'user-1' }
            }
          }
        },
        loaded: {}
      }
    });

    // NEGATIVE: invoke `onError` targeting an input-schema sibling omits `input`.
    s.createMachine({
      initial: 'loading',
      states: {
        loading: {
          // @ts-expect-error - onError target `loaded` requires input
          invoke: {
            src: 'load',
            onError: {
              target: 'loaded'
            }
          }
        },
        loaded: {}
      }
    });

    // POSITIVE TWIN: invoke `onError` supplying valid `input` — must compile clean.
    s.createMachine({
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: 'load',
            onError: {
              target: 'loaded',
              input: { userId: 'user-1' }
            }
          }
        },
        loaded: {}
      }
    });

    expect(true).toBe(true);
  });

  // A self-transition WITHOUT `reenter: true` does not re-enter its target, so
  // any provided input is dropped at runtime (see the backstop tests below).
  // Requiring `input` there would force the user to write the very thing the
  // runtime ignores, so it is relaxed to optional — but only for the self key,
  // and only when not re-entering. Cross-target transitions and re-entering
  // self-transitions still require input.
  it('self-transition without `reenter` relaxes input; cross-transition still requires it', () => {
    const s = setup({
      schemas: {
        events: {
          PING: z.object({}),
          GO: z.object({})
        }
      },
      states: {
        active: {
          schemas: {
            input: z.object({ count: z.number() })
          }
        },
        other: {
          schemas: {
            input: z.object({ id: z.string() })
          }
        }
      }
    });

    s.createMachine({
      initial: { target: 'active', input: { count: 1 } },
      states: {
        active: {
          on: {
            // POSITIVE: self-target without `reenter` — `input` may be omitted.
            PING: {
              target: 'active'
            },
            // NEGATIVE: `other` is a DIFFERENT input-schema sibling, so `input`
            // is still required even though the source relaxes its own self key.
            // @ts-expect-error - target `other` declares schemas.input, so input is required
            GO: {
              target: 'other'
            }
          }
        },
        other: {}
      }
    });

    expect(true).toBe(true);
  });

  it('self-transition with `reenter: true` still requires input', () => {
    const s = setup({
      schemas: {
        events: {
          PING: z.object({})
        }
      },
      states: {
        active: {
          schemas: {
            input: z.object({ count: z.number() })
          }
        }
      }
    });

    // NEGATIVE: `reenter: true` re-enters `active`, so its input IS applied and
    // therefore required — the relaxation must not leak into the re-enter case.
    s.createMachine({
      initial: { target: 'active', input: { count: 1 } },
      states: {
        active: {
          on: {
            // @ts-expect-error - reenter:true re-enters `active`, so input is required
            PING: {
              target: 'active',
              reenter: true
            }
          }
        }
      }
    });

    // POSITIVE TWIN: identical except it supplies `input` — must compile clean.
    s.createMachine({
      initial: { target: 'active', input: { count: 1 } },
      states: {
        active: {
          on: {
            PING: {
              target: 'active',
              reenter: true,
              input: { count: 2 }
            }
          }
        }
      }
    });

    expect(true).toBe(true);
  });

  // --- Runtime backstop (Change D) ---
  // Input on a transition whose target is NOT actually being (re)entered — the
  // classic case being a self-transition without `reenter: true` — would be
  // silently stored but never consumed. Detect that: emit a dev warning and do
  // NOT store the ignored input. These are real machine-execution tests.

  it('self-transition without `reenter` ignores provided input and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const s = setup({
      states: {
        active: {
          schemas: {
            input: z.object({ count: z.number() })
          }
        }
      }
    });

    const entryInputs: unknown[] = [];
    const machine = s.createMachine({
      initial: {
        target: 'active',
        input: { count: 1 }
      },
      states: {
        active: {
          entry: ({ input }) => {
            entryInputs.push(input);
          },
          on: {
            // Self-transition WITHOUT reenter, carrying a DISTINCT input value.
            PING: {
              target: 'active',
              input: { count: 2 }
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();

    // Baseline: initial input applied, entry fired exactly once.
    expect(actor.getSnapshot().getInputs()['(machine).active']).toEqual({
      count: 1
    });
    expect(entryInputs).toEqual([{ count: 1 }]);

    actor.send({ type: 'PING' });

    // The provided { count: 2 } is ignored: a warning fires naming the state
    // and telling the user how to fix it...
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('(machine).active');
    expect(warnSpy.mock.calls[0][0]).toContain('reenter: true');

    // ...the stored input is UNCHANGED (still the original { count: 1 }),
    // proving the ignored { count: 2 } was never stored...
    expect(actor.getSnapshot().getInputs()['(machine).active']).toEqual({
      count: 1
    });

    // ...and entry did not re-fire (no reenter).
    expect(entryInputs).toEqual([{ count: 1 }]);

    warnSpy.mockRestore();
  });

  it('self-transition with `reenter: true` applies the new input and does not warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const s = setup({
      states: {
        active: {
          schemas: {
            input: z.object({ count: z.number() })
          }
        }
      }
    });

    const entryInputs: unknown[] = [];
    const machine = s.createMachine({
      initial: {
        target: 'active',
        input: { count: 1 }
      },
      states: {
        active: {
          entry: ({ input }) => {
            entryInputs.push(input);
          },
          on: {
            // Self-transition WITH reenter: the state IS re-entered.
            PING: {
              target: 'active',
              reenter: true,
              input: { count: 2 }
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();
    expect(entryInputs).toEqual([{ count: 1 }]);

    actor.send({ type: 'PING' });

    // The guard does not over-suppress: no warning fires...
    expect(warnSpy).not.toHaveBeenCalled();

    // ...entry re-fired and saw the NEW input...
    expect(entryInputs).toEqual([{ count: 1 }, { count: 2 }]);

    // ...and the stored input is updated to the new value.
    expect(actor.getSnapshot().getInputs()['(machine).active']).toEqual({
      count: 2
    });

    warnSpy.mockRestore();
  });

  it('normal transition to a different target applies input and does not warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const s = setup({
      states: {
        idle: {},
        loading: {
          schemas: {
            input: z.object({ userId: z.string() })
          }
        }
      }
    });

    const entryInputs: unknown[] = [];
    const machine = s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            LOAD: {
              target: 'loading',
              input: { userId: 'user-1' }
            }
          }
        },
        loading: {
          entry: ({ input }) => {
            entryInputs.push(input);
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'LOAD' });

    // The common case is unaffected: no warning...
    expect(warnSpy).not.toHaveBeenCalled();

    // ...entry saw the input...
    expect(entryInputs).toEqual([{ userId: 'user-1' }]);

    // ...and it was stored.
    expect(actor.getSnapshot().getInputs()['(machine).loading']).toEqual({
      userId: 'user-1'
    });

    warnSpy.mockRestore();
  });

  // Runtime backstop (Change D) at the COMPOUND seam. The parent is itself a
  // compound state WITH an input schema, and the self-transition targets the
  // parent. Distinct input values (`pv: 1` vs `pv: 2`) make this non-vacuous:
  // whether the provided `{ pv: 2 }` is applied hinges solely on whether the
  // parent is actually re-entered. Without `reenter` the parent stays active
  // (not in the entry set), so its input is dropped and the dev warning fires;
  // with `reenter: true` the parent is re-entered, so its input is applied and
  // no warning fires. (The compound child re-enters via the default-entry path
  // in both cases — a separate code path — and never triggers the warning.)
  it('compound self-transition applies parent input only when the parent is re-entered', () => {
    const s = setup({
      states: {
        parent: {
          schemas: {
            input: z.object({ pv: z.number() })
          },
          states: {
            child: {}
          }
        }
      }
    });

    // --- Case A: self-transition to the compound parent WITHOUT `reenter`. ---
    // The parent stays active (not re-entered), so the provided `{ pv: 2 }` is
    // ignored, the original `{ pv: 1 }` is retained, and the warning fires.
    {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const parentEntries: unknown[] = [];
      const childEntries: string[] = [];

      const machine = s.createMachine({
        initial: {
          target: 'parent',
          input: { pv: 1 }
        },
        states: {
          parent: {
            initial: 'child',
            entry: ({ input }) => {
              parentEntries.push(input);
            },
            on: {
              // Compound self-transition WITHOUT reenter, carrying a DISTINCT input.
              PING: {
                target: 'parent',
                input: { pv: 2 }
              }
            },
            states: {
              child: {
                entry: () => {
                  childEntries.push('child');
                }
              }
            }
          }
        }
      });

      const actor = createActor(machine).start();

      // Baseline: the parent's own initial input `{ pv: 1 }` reached its entry
      // and was stored.
      expect(parentEntries).toEqual([{ pv: 1 }]);
      expect(childEntries).toEqual(['child']);
      expect(actor.getSnapshot().getInputs()['(machine).parent']).toEqual({
        pv: 1
      });

      actor.send({ type: 'PING' });

      // The parent is NOT re-entered → the provided `{ pv: 2 }` is ignored: the
      // warning fires once, naming the state and how to fix it...
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('ignored');
      expect(warnSpy.mock.calls[0][0]).toContain('(machine).parent');
      expect(warnSpy.mock.calls[0][0]).toContain('reenter: true');

      // ...the parent's entry did NOT re-fire and its stored input stays the
      // original `{ pv: 1 }`, proving the ignored `{ pv: 2 }` was never stored...
      expect(parentEntries).toEqual([{ pv: 1 }]);
      expect(actor.getSnapshot().getInputs()['(machine).parent']).toEqual({
        pv: 1
      });

      // ...while the compound child still re-entered via the default-entry path
      // (a separate code path that never triggers the warning).
      expect(childEntries).toEqual(['child', 'child']);

      warnSpy.mockRestore();
    }

    // --- Case B: self-transition to the compound parent WITH `reenter: true`. ---
    // The parent IS re-entered, so the provided `{ pv: 2 }` is applied (entry
    // re-fires) and stored; no warning fires.
    {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const parentEntries: unknown[] = [];
      const childEntries: string[] = [];

      const machine = s.createMachine({
        initial: {
          target: 'parent',
          input: { pv: 1 }
        },
        states: {
          parent: {
            initial: 'child',
            entry: ({ input }) => {
              parentEntries.push(input);
            },
            on: {
              // Compound self-transition WITH reenter, carrying a DISTINCT input.
              PING: {
                target: 'parent',
                reenter: true,
                input: { pv: 2 }
              }
            },
            states: {
              child: {
                entry: () => {
                  childEntries.push('child');
                }
              }
            }
          }
        }
      });

      const actor = createActor(machine).start();
      expect(parentEntries).toEqual([{ pv: 1 }]);
      expect(childEntries).toEqual(['child']);
      expect(actor.getSnapshot().getInputs()['(machine).parent']).toEqual({
        pv: 1
      });

      actor.send({ type: 'PING' });

      // The parent IS re-entered → no warning fires...
      expect(warnSpy).not.toHaveBeenCalled();

      // ...its entry re-fires and sees the NEW input `{ pv: 2 }`...
      expect(parentEntries).toEqual([{ pv: 1 }, { pv: 2 }]);

      // ...the stored input is updated to `{ pv: 2 }`...
      expect(actor.getSnapshot().getInputs()['(machine).parent']).toEqual({
        pv: 2
      });

      // ...and the child re-entered again as well.
      expect(childEntries).toEqual(['child', 'child']);

      warnSpy.mockRestore();
    }
  });
});
