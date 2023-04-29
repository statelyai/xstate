import { interpret, createMachine, assign } from '../src/index';
import { State } from '../src/State';

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

const configMachine = createMachine(
  {
    id: 'config',
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

  describe('machine.initialState', () => {
    it('should return a State instance', () => {
      expect(lightMachine.initialState).toBeInstanceOf(State);
    });

    it('should return the initial state', () => {
      expect(lightMachine.initialState.value).toEqual('green');
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
      const differentMachine = configMachine.provide({
        actions: {
          entryAction: () => {
            throw new Error('new entry');
          }
        },
        guards: { someCondition: () => true }
      });

      expect(differentMachine.getContext()).toEqual({ foo: 'bar' });

      const service = interpret(differentMachine);

      expect(() => {
        service.start();
      }).toThrowErrorMatchingInlineSnapshot(`"new entry"`);

      expect(
        differentMachine.transition('foo', { type: 'EVENT' }).value
      ).toEqual('bar');
    });

    it('should not override context if not defined', () => {
      const differentMachine = configMachine.provide({});

      expect(differentMachine.initialState.context).toEqual(
        configMachine.getContext()
      );
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
      const machine = createMachine({});

      expect(machine.initialState.context).toEqual({});
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
    const testMachineConfig = {
      initial: 'active',
      context: () => ({
        foo: { bar: 'baz' }
      }),
      states: {
        active: {}
      }
    };

    it('context from a function should be lazily evaluated', () => {
      const testMachine1 = createMachine(testMachineConfig);
      const testMachine2 = createMachine(testMachineConfig);

      expect(testMachine1.initialState.context).not.toBe(
        testMachine2.initialState.context
      );

      expect(testMachine1.initialState.context).toEqual({
        foo: { bar: 'baz' }
      });

      expect(testMachine2.initialState.context).toEqual({
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

      const barState = machine.transition(undefined, { type: 'NEXT' });

      const jsonBarState = JSON.parse(JSON.stringify(barState));

      expect(machine.resolveState(jsonBarState).matches('bar')).toBeTruthy();
    });

    it('should terminate on a resolved final state', (done) => {
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

      const nextState = machine.transition(undefined, { type: 'NEXT' });

      const persistedState = machine.getPersistedState(nextState);

      const service = interpret(machine, { state: persistedState });
      service.subscribe({
        complete: () => {
          // Should reach done state immediately
          done();
        }
      });

      service.start();
    });
  });

  describe('machine.getInitialState', () => {
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

      expect(machine.getInitialState().value).toBe('b');
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

      const state = testMachine.initialState;

      expect(state.value).toEqual({});

      const nextState = testMachine.transition(state, { type: 'INC' });

      expect(nextState.context.value).toEqual(43);
    });
  });
});

describe('StateNode', () => {
  it('should list transitions', () => {
    const greenNode = lightMachine.states.green;

    const transitions = greenNode.transitions;

    expect(transitions.map((t) => t.eventType)).toEqual([
      'TIMER',
      'POWER_OUTAGE',
      'FORBIDDEN_EVENT'
    ]);
  });
});
