import z from 'zod';
import { setup, createActor } from '../src/index.ts';

describe('setup', () => {
  it('should create a setup object with states', () => {
    const s = setup({
      states: {
        loading: {
          paramsSchema: z.object({
            userId: z.string()
          })
        }
      }
    });

    expect(s.states).toEqual({
      loading: {
        paramsSchema: expect.any(Object)
      }
    });
  });

  it('should create a setup object with nested state schemas', () => {
    const s = setup({
      states: {
        parent: {
          paramsSchema: z.object({
            parentId: z.string()
          }),
          states: {
            child: {
              paramsSchema: z.object({
                childId: z.string()
              })
            }
          }
        }
      }
    });

    expect(s.states.parent.states?.child.paramsSchema).toBeDefined();
  });

  it('should create a machine from setup', () => {
    const s = setup({
      states: {
        idle: {},
        loading: {
          paramsSchema: z.object({
            userId: z.string()
          })
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

  it('should preserve paramsSchema for multiple states', () => {
    const userIdSchema = z.object({ userId: z.string() });
    const nameSchema = z.object({ name: z.string() });

    const s = setup({
      states: {
        loading: { paramsSchema: userIdSchema },
        creating: { paramsSchema: nameSchema }
      }
    });

    expect(s.states.loading.paramsSchema).toBe(userIdSchema);
    expect(s.states.creating.paramsSchema).toBe(nameSchema);
  });

  it('entry action should receive params', () => {
    const entryParams: unknown[] = [];

    const s = setup({
      states: {
        idle: {},
        loading: {
          paramsSchema: z.object({
            userId: z.string()
          })
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
              params: { userId: 'user-123' }
            }
          }
        },
        loading: {
          entry: ({ params }) => {
            entryParams.push(params);
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'LOAD' });

    expect(entryParams).toEqual([{ userId: 'user-123' }]);
  });

  it('exit action should receive params', () => {
    const exitParams: unknown[] = [];

    const s = setup({
      states: {
        idle: {},
        loading: {
          paramsSchema: z.object({
            userId: z.string()
          })
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
              params: { userId: 'user-456' }
            }
          }
        },
        loading: {
          exit: ({ params }) => {
            exitParams.push(params);
          },
          on: {
            DONE: 'idle'
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'LOAD' });
    actor.send({ type: 'DONE' });

    expect(exitParams).toEqual([{ userId: 'user-456' }]);
  });

  it('transition should pass params to target state', () => {
    const receivedParams: unknown[] = [];

    const s = setup({
      states: {
        idle: {},
        fetching: {
          paramsSchema: z.object({
            url: z.string(),
            method: z.enum(['GET', 'POST'])
          })
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
              params: { url: '/api/users', method: 'GET' }
            }
          }
        },
        fetching: {
          entry: ({ params }) => {
            receivedParams.push(params);
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'FETCH' });

    expect(receivedParams).toEqual([{ url: '/api/users', method: 'GET' }]);
  });

  it('initial transition should accept params', () => {
    const entryParams: unknown[] = [];

    const s = setup({
      states: {
        loading: {
          paramsSchema: z.object({
            userId: z.string()
          })
        }
      }
    });

    const machine = s.createMachine({
      initial: {
        target: 'loading',
        params: { userId: 'initial-user' }
      },
      states: {
        loading: {
          entry: ({ params }) => {
            entryParams.push(params);
          }
        }
      }
    });

    createActor(machine).start();

    expect(entryParams).toEqual([{ userId: 'initial-user' }]);
  });

  it('params can be a function resolving dynamically', () => {
    const entryParams: unknown[] = [];

    const s = setup({
      states: {
        idle: {},
        loading: {
          paramsSchema: z.object({
            userId: z.string(),
            timestamp: z.number()
          })
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
      context: { currentUser: 'dynamic-user' },
      states: {
        idle: {
          on: {
            LOAD: {
              target: 'loading',
              params: ({ context }) => ({
                userId: context.currentUser,
                timestamp: 1234567890
              })
            }
          }
        },
        loading: {
          entry: ({ params }, enq) => {
            enq((params) => entryParams.push(params), params);
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'LOAD' });

    expect(entryParams).toEqual([
      { userId: 'dynamic-user', timestamp: 1234567890 }
    ]);
  });

  it('nested state should receive params from parent initial', () => {
    const entryParams: unknown[] = [];

    const s = setup({
      states: {
        parent: {
          states: {
            child: {
              paramsSchema: z.object({
                childValue: z.string()
              })
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
            params: { childValue: 'nested-param' }
          },
          states: {
            child: {
              entry: ({ params }, enq) => {
                enq((params) => entryParams.push(params), params);
              }
            }
          }
        }
      }
    });

    createActor(machine).start();

    expect(entryParams).toEqual([{ childValue: 'nested-param' }]);
  });

  it('should correctly type params in nested states', () => {
    const s = setup({
      states: {
        idle: {},
        active: {
          paramsSchema: z.object({ activeId: z.number() }),
          states: {
            loading: {
              paramsSchema: z.object({ loadingUrl: z.string() })
            },
            ready: {}
          }
        }
      }
    });

    // Type test: params should be typed correctly for each state
    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          entry: ({ params }) => {
            params satisfies undefined;
            // @ts-expect-error - params should be undefined, not string
            params satisfies string;
          }
        },
        active: {
          initial: 'loading',
          entry: ({ params }) => {
            params satisfies { activeId: number } | undefined;
            // @ts-expect-error - activeId should be number, not string
            params satisfies { activeId: string };
          },
          states: {
            loading: {
              entry: ({ params }) => {
                params satisfies { loadingUrl: string } | undefined;
                // @ts-expect-error - loadingUrl should be string, not number
                params satisfies { loadingUrl: number };
              }
            },
            ready: {
              entry: ({ params }) => {
                params satisfies undefined;
                // @ts-expect-error - params should be undefined, not object
                params satisfies { foo: string };
              }
            }
          }
        }
      }
    });

    expect(true).toBe(true);
  });
});
