import z from 'zod';
import { createActor, createMachine } from '../src/index.ts';

const pedestrianStates = {
  initial: 'walk',
  states: {
    walk: {
      contextSchema: z.object({
        color: z.literal('walk')
      }),
      on: {
        PED_COUNTDOWN: 'wait'
      }
    },
    wait: {
      on: {
        PED_COUNTDOWN: 'stop'
      }
    },
    stop: {}
  }
} as const;

const lightMachine = createMachine({
  initial: 'green',
  states: {
    green: {
      contextSchema: z.object({
        color: z.literal('green')
      }),
      on: {
        TIMER: 'yellow',
        POWER_OUTAGE: 'red',
        FORBIDDEN_EVENT: undefined
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
      ...pedestrianStates
    }
  }
});

describe('machine', () => {
  describe('machine.states', () => {
    it('should properly register machine states', () => {
      expect(Object.keys(lightMachine.states)).toEqual([
        'green',
        'yellow',
        'red'
      ]);
    });
  });

  describe('machine.events', () => {
    it('should return the set of events accepted by machine', () => {
      expect(lightMachine.events).toEqual([
        'TIMER',
        'POWER_OUTAGE',
        'PED_COUNTDOWN'
      ]);
    });
  });

  describe('machine.config', () => {
    it('state node config should reference original machine config', () => {
      const machine = createMachine({
        initial: 'one',
        states: {
          one: {
            initial: 'deep',
            states: {
              deep: {}
            }
          }
        }
      });

      const oneState = machine.states.one;

      expect(oneState.config).toBe(machine.config.states!.one);

      const deepState = machine.states.one.states.deep;

      expect(deepState.config).toBe(machine.config.states!.one.states!.deep);

      deepState.config.meta = 'testing meta';

      expect(machine.config.states!.one.states!.deep.meta).toEqual(
        'testing meta'
      );
    });
  });

  describe('machine.provide', () => {
    // https://github.com/davidkpiano/xstate/issues/674
    it('should throw if initial state is missing in a compound state', () => {
      expect(() => {
        createMachine({
          initial: 'first',
          states: {
            first: {
              states: {
                second: {},
                third: {}
              }
            }
          }
        });
      }).toThrow();
    });

    it('machines defined without context should have a default empty object for context', () => {
      expect(createActor(createMachine({})).getSnapshot().context).toEqual({});
    });

    it('should lazily create context for all interpreter instances created from the same machine template created by `provide`', () => {
      const machine = createMachine({
        schemas: {
          context: z.object({
            foo: z.object({
              prop: z.string()
            })
          })
        },
        context: () => ({
          foo: { prop: 'baz' }
        })
      });

      const copiedMachine = machine.provide({});

      const a = createActor(copiedMachine).start();
      const b = createActor(copiedMachine).start();

      expect(a.getSnapshot().context.foo).not.toBe(b.getSnapshot().context.foo);
    });
  });

  describe('machine function context', () => {
    it('context from a function should be lazily evaluated', () => {
      const config = {
        initial: 'active',
        context: () => ({
          foo: { bar: 'baz' }
        }),
        states: {
          active: {}
        }
      };
      const testMachine1 = createMachine(config);
      const testMachine2 = createMachine(config);

      const initialState1 = createActor(testMachine1).getSnapshot();
      const initialState2 = createActor(testMachine2).getSnapshot();

      expect(initialState1.context).not.toBe(initialState2.context);

      expect(initialState1.context).toEqual({
        foo: { bar: 'baz' }
      });

      expect(initialState2.context).toEqual({
        foo: { bar: 'baz' }
      });
    });
  });

  describe('machine.resolveState()', () => {
    const resolveMachine = createMachine({
      id: 'resolve',
      initial: 'foo',
      states: {
        foo: {
          initial: 'one',
          states: {
            one: {
              type: 'parallel',
              states: {
                a: {
                  initial: 'aa',
                  states: { aa: {} }
                },
                b: {
                  initial: 'bb',
                  states: { bb: {} }
                }
              },
              on: {
                TO_TWO: 'two'
              }
            },
            two: {
              on: { TO_ONE: 'one' }
            }
          },
          on: {
            TO_BAR: 'bar'
          }
        },
        bar: {
          on: {
            TO_FOO: 'foo'
          }
        }
      }
    });

    it('should resolve the state value', () => {
      const resolvedState = resolveMachine.resolveState({ value: 'foo' });

      expect(resolvedState.value).toEqual({
        foo: { one: { a: 'aa', b: 'bb' } }
      });
    });

    it('should resolve `status: done`', () => {
      const machine = createMachine({
        initial: 'foo',
        states: {
          foo: {
            on: { NEXT: 'bar' }
          },
          bar: {
            type: 'final'
          }
        }
      });

      const resolvedState = machine.resolveState({ value: 'bar' });

      expect(resolvedState.status).toBe('done');
    });
  });

  describe('initial state', () => {
    it('should follow always transition', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            always: { target: 'b' }
          },
          b: {}
        }
      });

      expect(createActor(machine).getSnapshot().value).toBe('b');
    });
  });

  describe('versioning', () => {
    it('should allow a version to be specified', () => {
      const versionMachine = createMachine({
        id: 'version',
        version: '1.0.4',
        states: {}
      });

      expect(versionMachine.version).toEqual('1.0.4');
    });
  });

  describe('id', () => {
    it('should represent the ID', () => {
      const idMachine = createMachine({
        id: 'some-id',
        initial: 'idle',
        states: { idle: {} }
      });

      expect(idMachine.id).toEqual('some-id');
    });

    it('should represent the ID (state node)', () => {
      const idMachine = createMachine({
        id: 'some-id',
        initial: 'idle',
        states: {
          idle: {
            id: 'idle'
          }
        }
      });

      expect(idMachine.states.idle.id).toEqual('idle');
    });

    it('should use the key as the ID if no ID is provided (state node)', () => {
      const noStateNodeIDMachine = createMachine({
        id: 'some-id',
        initial: 'idle',
        states: { idle: {} }
      });

      expect(noStateNodeIDMachine.states.idle.id).toEqual('some-id.idle');
    });
  });

  describe('combinatorial machines', () => {
    it('should support combinatorial machines (single-state)', () => {
      const testMachine = createMachine({
        // types: {} as { context: { value: number } },
        schemas: {
          context: z.object({ value: z.number() })
        },
        context: { value: 42 },
        on: {
          INC: ({ context }) => ({
            context: {
              value: context.value + 1
            }
          })
        }
      });

      const actorRef = createActor(testMachine);
      expect(actorRef.getSnapshot().value).toEqual({});

      actorRef.start();
      actorRef.send({ type: 'INC' });

      expect(actorRef.getSnapshot().context.value).toEqual(43);
    });
  });

  it('should pass through schemas', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({ count: z.number() })
      },
      context: () => ({ count: 42 })
    });

    expect(machine.schemas).toEqual(
      expect.objectContaining({
        context: expect.anything()
      })
    );
  });
});

describe('StateNode', () => {
  it('should list transitions', () => {
    const greenNode = lightMachine.states.green;

    const transitions = greenNode.transitions;

    expect([...transitions.keys()]).toEqual([
      'TIMER',
      'POWER_OUTAGE',
      'FORBIDDEN_EVENT'
    ]);
  });
});

describe('typestates', () => {
  it('testing', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({
          user: z.string().nullable()
        })
      },
      context: {
        user: null
      },
      initial: 'active',
      states: {
        active: {
          contextSchema: z.object({
            user: z.string()
          }),
          on: {
            ACTIVATE: (x) => ({
              target: 'inactive',
              context: {
                ...x.context,
                user: 'test'
              }
            })
          }
        },
        inactive: {
          contextSchema: z.object({
            user: z.null()
          })
        }
      }
    });

    machine.states;
  });
});
