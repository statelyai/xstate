import z from 'zod';
import { setup, createActor } from '../src/index.ts';

describe('setup', () => {
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
            DONE: 'idle'
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
});
