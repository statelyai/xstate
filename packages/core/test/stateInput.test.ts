import z from 'zod';
import { setup, createActor, types } from '../src/index.ts';
import type {
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
