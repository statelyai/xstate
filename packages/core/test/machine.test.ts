import { interpret, createMachine, assign } from '../src/index.ts';
import { State } from '../src/State.ts';

const pedestrianStates = {
  initial: 'walk',
  states: {
    walk: {
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
};

const lightMachine = createMachine({
  initial: 'green',
  states: {
    green: {
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
    it('should override guards and actions', () => {
      const machine = createMachine(
        {
          initial: 'foo',
          context: {
            foo: 'bar'
          },
          states: {
            foo: {
              entry: 'entryAction',
              on: {
                EVENT: {
                  target: 'bar',
                  guard: 'someCondition'
                }
              }
            },
            bar: {}
          }
        },
        {
          actions: {
            entryAction: () => {
              throw new Error('original entry');
            }
          },
          guards: {
            someCondition: () => false
          }
        }
      );
      let shouldThrow = true;
      const differentMachine = machine.provide({
        actions: {
          entryAction: () => {
            if (shouldThrow) {
              throw new Error('new entry');
            }
          }
        },
        guards: { someCondition: () => true }
      });

      expect(interpret(differentMachine).getSnapshot().context).toEqual({
        foo: 'bar'
      });

      expect(() => {
        interpret(differentMachine).start();
      }).toThrowErrorMatchingInlineSnapshot(`"new entry"`);

      shouldThrow = false;
      const actorRef = interpret(differentMachine).start();
      actorRef.send({ type: 'EVENT' });

      expect(actorRef.getSnapshot().value).toEqual('bar');
    });

    it('should not override context if not defined', () => {
      const machine = createMachine({
        context: {
          foo: 'bar'
        }
      });
      const differentMachine = machine.provide({});
      const actorRef = interpret(differentMachine).start();
      expect(actorRef.getSnapshot().context).toEqual({ foo: 'bar' });
    });

    it.skip('should override context (second argument)', () => {
      // const differentMachine = configMachine.withConfig(
      //   {},
      //   { foo: 'different' }
      // );
      // expect(differentMachine.initialState.context).toEqual({
      //   foo: 'different'
      // });
    });

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
      expect(interpret(createMachine({})).getSnapshot().context).toEqual({});
    });

    it('should lazily create context for all interpreter instances created from the same machine template created by `provide`', () => {
      const machine = createMachine<{ foo: { prop: string } }>({
        context: () => ({
          foo: { prop: 'baz' }
        })
      });

      const copiedMachine = machine.provide({});

      const a = interpret(copiedMachine).start();
      const b = interpret(copiedMachine).start();

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

      const initialState1 = interpret(testMachine1).getSnapshot();
      const initialState2 = interpret(testMachine2).getSnapshot();

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
      const tempState = State.from('foo', undefined, resolveMachine);

      const resolvedState = resolveMachine.resolveState(tempState);

      expect(resolvedState.value).toEqual({
        foo: { one: { a: 'aa', b: 'bb' } }
      });
    });

    it('should resolve the state configuration (implicit via events)', () => {
      const tempState = State.from('foo', undefined, resolveMachine);

      const resolvedState = resolveMachine.resolveState(tempState);

      expect(resolvedState.nextEvents.sort()).toEqual(['TO_BAR', 'TO_TWO']);
    });

    it('should resolve .done', () => {
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
      const tempState = State.from('bar', undefined, machine);

      const resolvedState = machine.resolveState(tempState);

      expect(resolvedState.done).toBe(true);
    });

    it('should resolve from a state config object', () => {
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

      const actorRef = interpret(machine).start();
      actorRef.send({ type: 'NEXT' });
      const barState = actorRef.getSnapshot();

      const jsonBarState = JSON.parse(JSON.stringify(barState));

      expect(machine.resolveState(jsonBarState).matches('bar')).toBeTruthy();
    });

    it('should terminate on a resolved final state', () => {
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

      const actorRef = interpret(machine).start();
      actorRef.send({ type: 'NEXT' });
      const persistedState = actorRef.getPersistedState();

      const spy = jest.fn();
      const actorRef2 = interpret(machine, { state: persistedState });
      actorRef2.subscribe({
        complete: spy
      });

      actorRef2.start();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('initial state', () => {
    it('should follow always transition', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            always: [{ target: 'b' }]
          },
          b: {}
        }
      });

      expect(interpret(machine).getSnapshot().value).toBe('b');
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
      const testMachine = createMachine<{ value: number }>({
        context: { value: 42 },
        on: {
          INC: {
            actions: assign({ value: ({ context }) => context.value + 1 })
          }
        }
      });

      const actorRef = interpret(testMachine);
      expect(actorRef.getSnapshot().value).toEqual({});

      actorRef.start();
      actorRef.send({ type: 'INC' });

      expect(actorRef.getSnapshot().context.value).toEqual(43);
    });
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
