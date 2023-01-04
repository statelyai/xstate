import { assign, createMachine, interpret } from '../src';
import { fromPromise } from '../src/behaviors';
import { StateMachineConfig } from '../src/types';

it('should work', () => {
  const machine = createMachine({
    initial: 'green',
    context: {},
    states: {
      green: {
        on: {
          TIMER: 'yellow'
        }
      },
      yellow: {
        on: {
          TIMER: { target: 'red' }
        }
      },
      red: {
        on: {
          TIMER: 'green'
        }
      }
    }
  });

  const yellowState = machine.transition(machine.initialState, {
    type: 'TIMER'
  });

  expect(yellowState.value).toEqual('yellow');

  const redState = machine.transition(yellowState, { type: 'TIMER' });

  expect(redState.value).toEqual('red');
});

describe('guards', () => {
  it('should not take a transition if guard is falsey', () => {
    const machine = createMachine({
      initial: 'inactive',
      context: {},
      states: {
        inactive: {
          on: {
            TOGGLE: {
              target: 'active',
              guard: () => false
            }
          }
        },
        active: {}
      }
    });

    const nextState = machine.transition(machine.initialState, {
      type: 'TOGGLE'
    });

    expect(nextState.value).toEqual('inactive');
  });
});

describe('assign', () => {
  it('should work with assignments', () => {
    const machine = createMachine({
      context: { count: 0 },
      initial: 'active',
      states: {
        active: {
          on: {
            INC: {
              target: 'active',
              actions: [assign({ count: 1 })]
            }
          }
        }
      }
    });

    const nextState = machine.transition(machine.initialState, { type: 'INC' });

    expect(nextState).toEqual(
      expect.objectContaining({ value: 'active', context: { count: 1 } })
    );
  });
});

// ............

describe('@xstate/fsm', () => {
  interface LightContext {
    count: number;
    foo: string | undefined;
    go: boolean;
  }

  type LightEvent =
    | { type: 'TIMER' }
    | { type: 'INC' }
    | { type: 'EMERGENCY'; value: number };

  const lightConfig: StateMachineConfig<{
    context: LightContext;
    events: LightEvent;
  }> = {
    initial: 'green',
    context: { count: 0, foo: 'bar', go: true },
    states: {
      green: {
        entry: 'enterGreen',
        exit: [
          'exitGreen',
          assign({ count: (ctx) => ctx.count + 1 }),
          assign({ count: (ctx) => ctx.count + 1 }),
          assign({ foo: 'static' }),
          assign({ foo: (ctx) => ctx.foo + '++' })
        ],
        on: {
          TIMER: {
            target: 'yellow',
            actions: ['g-y 1', 'g-y 2']
          }
        }
      },
      yellow: {
        entry: assign({ go: false }),
        on: {
          INC: { actions: assign({ count: (ctx) => ctx.count + 1 }) },
          EMERGENCY: {
            target: 'red',
            guard: (ctx, e) => ctx.count + e.value === 2
          }
        }
      },
      red: {}
    }
  };
  const lightFSM = createMachine(lightConfig);
  it('should return back the config object', () => {
    expect(lightFSM.config).toBe(lightConfig);
  });

  it('should have the correct initial state', () => {
    const { initialState } = lightFSM;

    expect(initialState.value).toEqual('green');
    expect(initialState.actions).toEqual([{ type: 'enterGreen' }]);
  });
  it('should have initial context updated by initial assign actions', () => {
    const { initialState } = createMachine({
      initial: 'init',
      context: {
        count: 0
      },
      states: {
        init: {
          entry: assign({
            count: () => 1
          })
        }
      }
    });

    expect(initialState.context).toEqual({ count: 1 });
  });
  it('should have initial actions computed without assign actions', () => {
    const { initialState } = createMachine({
      initial: 'init',
      context: {
        count: 0
      },
      states: {
        init: {
          entry: [
            { type: 'foo' },
            assign({
              count: () => 1
            })
          ]
        }
      }
    });

    expect(initialState.actions).toContainEqual({ type: 'foo' });
  });
  it('should transition correctly', () => {
    const nextState = lightFSM.transition(lightFSM.initialState, {
      type: 'TIMER'
    });
    expect(nextState.value).toEqual('yellow');
    expect(nextState.actions.map((action) => action.type)).toEqual([
      'exitGreen',
      'xstate.assign',
      'xstate.assign',
      'xstate.assign',
      'xstate.assign',
      'g-y 1',
      'g-y 2',
      'xstate.assign'
    ]);
    expect(nextState.context).toEqual({
      count: 2,
      foo: 'static++',
      go: false
    });
  });

  it('should stay on the same state for undefined transitions', () => {
    const nextState = lightFSM.transition(lightFSM.initialState, {
      // @ts-ignore
      type: 'FAKE'
    });
    expect(nextState.value).toBe('green');
    expect(nextState.actions).toEqual([]);
  });

  it('should throw an error for undefined states', () => {
    // intentionally "corrupt" the state
    const state = { ...lightFSM.initialState, value: 'unknown' };

    expect(() => {
      lightFSM.transition(state, { type: 'TIMER' });
    }).toThrow();
  });

  it('should throw an error for undefined next state config', () => {
    const testConfig: StateMachineConfig<any> = {
      initial: 'green',
      states: {
        green: {
          on: {
            TARGET_INVALID: 'blue'
          }
        },
        yellow: {}
      }
    };
    const testMachine = createMachine(testConfig);
    expect(() => {
      testMachine.transition(testMachine.initialState, {
        type: 'TARGET_INVALID'
      });
    }).toThrowErrorMatchingInlineSnapshot(
      `"State node not found for state value 'blue'"`
    );
  });

  it('should work with guards', () => {
    const fsm = createMachine<{
      context: { count: number };
      events:
        | { type: 'NEXT'; value: number }
        | { type: 'SET_COUNT'; value: number };
    }>({
      initial: 'inactive',
      context: {
        count: 0
      },
      states: {
        inactive: {
          on: {
            NEXT: {
              target: 'active',
              guard: (ctx, e) => ctx.count === 42 && e.value === 10
            },
            SET_COUNT: {
              actions: assign({
                count: (_, e) => e.value
              })
            }
          }
        },
        active: {}
      }
    });

    const inactiveState1 = fsm.transition(fsm.initialState, {
      type: 'NEXT',
      value: 0
    });

    expect(inactiveState1.value).toEqual('inactive');

    const inactiveState2 = fsm.transition(fsm.initialState, {
      type: 'NEXT',
      value: 10
    });

    expect(inactiveState2.value).toEqual('inactive');

    const inactiveState3 = fsm.transition(fsm.initialState, {
      type: 'SET_COUNT',
      value: 42
    });

    expect(inactiveState3.value).toEqual('inactive');

    const inactiveState4 = fsm.transition(inactiveState3, {
      type: 'NEXT',
      value: 10
    });

    expect(inactiveState4.value).toEqual('active');
  });

  it('should be changed if state changes', () => {
    expect(
      lightFSM.transition(lightFSM.initialState, { type: 'TIMER' }).changed
    ).toBe(true);
  });

  it('should be changed if any actions occur', () => {
    const fsm = createMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            EV: {
              actions: 'doSomething'
            }
          }
        }
      }
    });
    expect(fsm.transition(fsm.initialState, { type: 'EV' }).changed).toBe(true);
  });

  it('should not be changed on unknown transitions', () => {
    const fsm = createMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            EV: {
              actions: 'doSomething'
            }
          }
        }
      }
    });

    expect(fsm.transition(fsm.initialState, { type: 'UNKNOWN' }).changed).toBe(
      false
    );
  });

  it('should match initialState', () => {
    const { initialState } = lightFSM;

    expect(initialState.value === 'green').toBeTruthy();

    if (initialState.value === 'green') {
      expect(initialState.context.go).toBeTruthy();
    }
  });

  it('should match transition states', () => {
    const { initialState } = lightFSM;
    const nextState = lightFSM.transition(initialState, { type: 'TIMER' });

    expect(nextState.value === 'yellow').toBeTruthy();

    if (nextState.value === 'yellow') {
      expect(nextState.context.go).toBeFalsy();
    }
  });
});

describe('interpreter', () => {
  const toggleMachine = createMachine({
    initial: 'active',
    states: {
      active: {
        on: { TOGGLE: 'inactive' }
      },
      inactive: {}
    }
  });

  it('listeners should immediately get the initial state', (done) => {
    const toggleService = interpret(toggleMachine).start();

    toggleService.subscribe((state) => {
      if (state.value === 'active') {
        done();
      }
    });
  });

  it('listeners should subscribe to state changes', (done) => {
    const toggleService = interpret(toggleMachine).start();

    toggleService.subscribe((state) => {
      if (state.value === 'inactive') {
        done();
      }
    });

    toggleService.send({ type: 'TOGGLE' });
  });

  it('should execute actions', (done) => {
    let executed = false;

    const actionMachine = createMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            TOGGLE: {
              target: 'inactive',
              actions: () => {
                executed = true;
              }
            }
          }
        },
        inactive: {}
      }
    });

    const actionService = interpret(actionMachine).start();

    actionService.subscribe(() => {
      if (executed) {
        done();
      }
    });

    actionService.send({ type: 'TOGGLE' });
  });

  it('should execute initial entry action', () => {
    let executed = false;

    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          entry: () => {
            executed = true;
          }
        }
      }
    });

    interpret(machine).start();
    expect(executed).toBe(true);
  });

  it('should lookup string actions in options', () => {
    let executed = false;

    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          entry: 'testAction'
        }
      }
    }).provide({
      actions: {
        testAction: () => {
          executed = true;
        }
      }
    });

    interpret(machine).start();

    expect(executed).toBe(true);
  });

  it('should reveal the current state', () => {
    const machine = createMachine({
      initial: 'test',
      context: { foo: 'bar' },
      states: {
        test: {}
      }
    });
    const service = interpret(machine);

    service.start();

    expect(service.getSnapshot().value).toEqual('test');
    expect(service.getSnapshot().context).toEqual({ foo: 'bar' });
  });

  it('should reveal the current state after transition', (done) => {
    const machine = createMachine({
      initial: 'test',
      context: { foo: 'bar' },
      states: {
        test: {
          on: { CHANGE: 'success' }
        },
        success: {}
      }
    });
    const service = interpret(machine);

    service.start();

    service.subscribe(() => {
      if (service.getSnapshot().value === 'success') {
        done();
      }
    });

    service.send({ type: 'CHANGE' });
  });

  it('should not re-execute exit/entry actions for transitions with undefined targets', () => {
    const machine = createMachine({
      initial: 'test',
      states: {
        test: {
          entry: ['entry'],
          exit: ['exit'],
          on: {
            EVENT: {
              // undefined target
              actions: ['action']
            }
          }
        }
      }
    });

    const { initialState } = machine;

    expect(initialState.actions.map((a) => a.type)).toEqual(['entry']);

    const nextState = machine.transition(initialState, { type: 'EVENT' });

    expect(nextState.actions.map((a) => a.type)).toEqual(['action']);
  });

  describe('`start` method', () => {
    it('should start the service with initial state by default', () => {
      const machine = createMachine({
        initial: 'foo',
        states: {
          foo: {
            on: {
              NEXT: 'bar'
            }
          },
          bar: {}
        }
      });

      const service = interpret(machine).start();

      expect(service.getSnapshot().value).toBe('foo');
    });

    it('should rehydrate the state if the state if provided', () => {
      const machine = createMachine({
        initial: 'foo',
        states: {
          foo: {
            on: {
              NEXT: 'bar'
            }
          },
          bar: {
            on: {
              NEXT: 'baz'
            }
          },
          baz: {}
        }
      });

      const barState = machine.transition(machine.initialState, {
        type: 'NEXT'
      });

      const service = interpret(machine).start(barState);
      expect(service.getSnapshot().value).toBe('bar');

      service.send({ type: 'NEXT' });
      expect(service.getSnapshot().value === 'baz').toBe(true);
    });

    it('should rehydrate the state and the context if both are provided', () => {
      const machine = createMachine({
        initial: 'foo',
        context: {
          hello: 'world'
        },
        states: {
          foo: {
            on: {
              NEXT: 'bar'
            }
          },
          bar: {
            on: {
              NEXT: 'baz'
            }
          },
          baz: {}
        }
      });

      const barState = machine.transition(machine.initialState, {
        type: 'NEXT'
      });

      const service = interpret(machine).start(barState);
      expect(service.getSnapshot().value).toBe('bar');
      expect(service.getSnapshot().context).toEqual({ hello: 'world' });

      service.send({ type: 'NEXT' });
      expect(service.getSnapshot().value === 'baz').toBe(true);
    });

    it('should execute initial actions when re-starting a service', () => {
      let entryActionCalled = false;
      const machine = createMachine({
        initial: 'test',
        states: {
          test: {
            entry: () => (entryActionCalled = true)
          }
        }
      });

      const service = interpret(machine).start();
      service.stop();

      entryActionCalled = false;

      service.start();

      expect(entryActionCalled).toBe(true);
    });

    it('should execute initial actions when re-starting a service that transitioned to a different state', () => {
      let entryActionCalled = false;
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            entry: () => (entryActionCalled = true),
            on: {
              NEXT: 'b'
            }
          },
          b: {}
        }
      });

      const service = interpret(machine).start();
      service.send({ type: 'NEXT' });
      service.stop();

      entryActionCalled = false;

      service.start();

      expect(entryActionCalled).toBe(true);
    });

    it('should not execute actions of the last known non-initial state when re-starting a service', () => {
      let entryActionCalled = false;
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              NEXT: 'b'
            }
          },
          b: {
            entry: () => (entryActionCalled = true)
          }
        }
      });

      const service = interpret(machine).start();
      service.send({ type: 'NEXT' });
      service.stop();

      entryActionCalled = false;

      service.start();

      expect(entryActionCalled).toBe(false);
    });
  });
});

const approvalMachine = createMachine({
  initial: 'pending',
  states: {
    pending: {
      on: {
        APPROVE: 'approved',
        REJECT: 'rejected'
      },
      exit: 'someExitAction'
    },
    approved: {
      entry: 'someEntryAction'
      // type: 'final'
    },
    rejected: {
      on: {
        APPEAL: 'pending'
      }
    }
  }
});

const actor = interpret(approvalMachine);

actor.start();

const dogBehavior = fromPromise(() =>
  // creates a behavior from a promise
  fetch('https://dog.ceo/api/breeds/image/random')
);

const dogActor = interpret(dogBehavior);

dogActor.start(); // start the promise

dogActor.subscribe((data) => {
  console.log(data); // the dog stuff
});
