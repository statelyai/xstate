import { createMachine, interpret, StateMachine } from '../src';
import {
  createMachine2,
  interpret as interpret2,
  assign as assign2,
  createPromiseBehavior
} from '../src/createMachine';

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

  type LightState =
    | {
        value: 'green';
        context: LightContext & { go: true };
      }
    | {
        value: 'yellow';
        context: LightContext & { go: false };
      }
    | {
        value: 'red';
        context: LightContext & { go: false };
      };

  const lightConfig: StateMachine.Config<
    LightContext,
    LightEvent,
    LightState
  > = {
    id: 'light',
    initial: 'green',
    context: { count: 0, foo: 'bar', go: true },
    states: {
      green: {
        entry: 'enterGreen',
        exit: [
          'exitGreen',
          assign2({ count: (ctx) => ctx.count + 1 }),
          assign2({ count: (ctx) => ctx.count + 1 }),
          assign2({ foo: 'static' }),
          assign2({ foo: (ctx) => ctx.foo + '++' })
        ],
        on: {
          TIMER: {
            target: 'yellow',
            actions: ['g-y 1', 'g-y 2']
          }
        }
      },
      yellow: {
        entry: assign2({ go: false }),
        on: {
          INC: { actions: assign2({ count: (ctx) => ctx.count + 1 }) },
          EMERGENCY: {
            target: 'red',
            cond: (ctx, e) => ctx.count + e.value === 2
          }
        }
      },
      red: {}
    }
  };
  const lightFSM = createMachine<LightContext, LightEvent, LightState>(
    lightConfig
  );
  it('should return back the config object', () => {
    expect(lightFSM.config).toBe(lightConfig);
  });
  it('should have the correct initial state', () => {
    const { initialState } = createMachine2({
      initial: 'green',
      context: {},
      states: {
        green: {
          entry: 'enterGreen'
        }
      }
    });

    expect(initialState.value).toEqual('green');
    expect(initialState.actions).toEqual([{ type: 'enterGreen' }]);
  });
  it('should have initial context updated by initial assign actions', () => {
    const { initialState } = createMachine2({
      initial: 'init',
      context: {
        count: 0
      },
      states: {
        init: {
          entry: assign2({
            count: () => 1
          }) as any // TODO: FIX
        }
      }
    });

    expect(initialState.context).toEqual({ count: 1 });
  });
  it.skip('should have initial actions computed without assign actions', () => {
    const { initialState } = createMachine({
      initial: 'init',
      context: {
        count: 0
      },
      states: {
        init: {
          entry: [
            { type: 'foo' },
            assign2({
              count: () => 1
            })
          ]
        }
      }
    });

    expect(initialState.actions).toEqual([{ type: 'foo' }]);
  });
  it('should transition correctly', () => {
    const fsm = createMachine2({
      id: 'light',
      initial: 'green',
      context: { count: 0, foo: 'bar', go: true },
      states: {
        green: {
          entry: 'enterGreen',
          exit: [
            'exitGreen',
            assign2({ count: (ctx) => ctx.count + 1 }),
            assign2({ count: (ctx) => ctx.count + 1 }),
            assign2({ foo: 'static' }),
            assign2({ foo: (ctx) => ctx.foo + '++' })
          ],
          on: {
            TIMER: {
              target: 'yellow',
              actions: ['g-y 1', 'g-y 2']
            }
          }
        },
        yellow: {
          entry: assign2({ go: false })
        },
        red: {}
      }
    });
    const nextState = fsm.transition(fsm.initialState, { type: 'TIMER' });
    expect(nextState.value).toEqual('yellow');
    expect(nextState.actions.map((action) => action.type))
      .toMatchInlineSnapshot(`
      Array [
        "exitGreen",
        "xstate.assign",
        "xstate.assign",
        "xstate.assign",
        "xstate.assign",
        "g-y 1",
        "g-y 2",
        "xstate.assign",
      ]
    `);
    expect(nextState.context).toEqual({
      count: 2,
      foo: 'static++',
      go: false
    });
  });

  it('should stay on the same state for undefined transitions', () => {
    const fsm = createMachine2({
      initial: 'green',
      context: {},
      states: {
        green: {
          on: {
            EVENT: 'yellow'
          }
        },
        yellow: {}
      }
    });
    const nextState = fsm.transition(fsm.initialState, { type: 'FAKE' });
    expect(nextState.value).toBe('green');
    expect(nextState.actions).toEqual([]);
  });

  it('should throw an error for undefined states', () => {
    expect(() => {
      const fsm = createMachine2({
        initial: 'a',
        context: {},
        states: { a: {} }
      });
      fsm.transition({ value: 'unknown', actions: [] } as any, {
        type: 'TIMER'
      });
    }).toThrow();
  });

  it('should throw an error for undefined next state config', () => {
    const invalidState = 'blue';

    const testMachine = createMachine2({
      id: 'test',
      context: {},
      initial: 'green',
      states: {
        green: {
          on: {
            TARGET_INVALID: invalidState as any
          }
        },
        yellow: {}
      }
    });
    expect(() => {
      testMachine.transition(testMachine.initialState, {
        type: 'TARGET_INVALID'
      });
    }).toThrowErrorMatchingInlineSnapshot(`"Invalid next state value: blue"`);
  });

  it('should work with guards', () => {
    const fsm = createMachine2({
      initial: 'inactive',
      schema: {
        event: {} as { type: 'INC'; value: number } | { type: 'EVENT' }
      },
      context: { count: 0, foo: 'bar', go: true },
      states: {
        inactive: {
          on: {
            EVENT: {
              target: 'active',
              guard: (ctx) => ctx.count > 3
            },
            INC: {
              actions: assign2({
                count: (ctx, e) => ctx.count + (e as any).value
              })
            }
          }
        },
        active: {}
      }
    });
    const inactiveState = fsm.transition(fsm.initialState, {
      type: 'EVENT'
    });
    expect(inactiveState.value).toEqual('inactive');

    const incState = fsm.transition(fsm.initialState, {
      type: 'INC',
      value: 5
    } as any);
    const activeState = fsm.transition(incState, { type: 'EVENT' });
    expect(activeState.value).toEqual('active');
  });

  it.skip('should be changed if state changes', () => {
    expect(lightFSM.transition('green', 'TIMER').changed).toBe(true);
  });

  it.skip('should be changed if any actions occur', () => {
    expect(lightFSM.transition('yellow', 'INC').changed).toBe(true);
  });

  it.skip('should not be changed on unknown transitions', () => {
    expect(lightFSM.transition('yellow', 'UNKNOWN' as any).changed).toBe(false);
  });

  it('should match initialState', () => {
    const { initialState } = lightFSM;

    expect(initialState.matches('green')).toBeTruthy();

    if (initialState.matches('green')) {
      expect(initialState.context.go).toBeTruthy();
    }
  });

  it('should match transition states', () => {
    const lightFSM2 = createMachine2({
      initial: 'green',
      context: {
        go: true
      },
      states: {
        green: {
          on: { TIMER: 'yellow' }
        },
        yellow: {
          entry: assign2({
            go: false
          })
        }
      }
    });
    const nextState = lightFSM2.transition(lightFSM2.initialState, {
      type: 'TIMER'
    });

    expect(nextState.matches('yellow')).toBeTruthy();

    if (nextState.matches('yellow')) {
      expect(nextState.context.go).toBeFalsy();
    }
  });
});

describe('interpreter', () => {
  it('listeners should immediately get the initial state', (done) => {
    const toggleMachine = createMachine2({
      initial: 'active',
      context: {},
      states: {
        active: {
          on: { TOGGLE: 'inactive' }
        },
        inactive: {}
      }
    });
    const toggleService = interpret2(toggleMachine).start();

    toggleService.subscribe((state) => {
      if (state.matches('active')) {
        done();
      }
    });
  });

  it('listeners should subscribe to state changes', (done) => {
    const toggleMachine = createMachine2({
      initial: 'active',
      context: {},
      states: {
        active: {
          on: { TOGGLE: 'inactive' }
        },
        inactive: {}
      }
    });
    const toggleService = interpret2(toggleMachine).start();

    toggleService.subscribe((state) => {
      if (state.matches('inactive')) {
        done();
      }
    });

    toggleService.send({ type: 'TOGGLE' });
  });

  it('should execute actions', (done) => {
    let executed = false;

    const actionMachine = createMachine2({
      initial: 'active',
      context: {},
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

    const actionService = interpret2(actionMachine).start();

    actionService.subscribe(() => {
      if (executed) {
        done();
      }
    });

    actionService.send({ type: 'TOGGLE' });
  });

  describe('`start` method', () => {
    it('should start the service with initial state by default', () => {
      const machine = createMachine2({
        initial: 'foo',
        context: {},
        states: {
          foo: {
            on: {
              NEXT: 'bar'
            }
          },
          bar: {}
        }
      });

      const service = interpret2(machine).start();

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

      const service = interpret(machine).start('bar');
      expect(service.state.value).toBe('bar');

      service.send('NEXT');
      expect(service.state.matches('baz')).toBe(true);
    });

    it('should rehydrate the state and the context if both are provided', () => {
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

      const context = { hello: 'world' };
      const service = interpret(machine).start({ value: 'bar', context });
      expect(service.state.value).toBe('bar');
      expect(service.state.context).toBe(context);

      service.send('NEXT');
      expect(service.state.matches('baz')).toBe(true);
    });
  });

  it('should execute initial entry action', () => {
    let executed = false;

    const machine = createMachine2({
      initial: 'foo',
      context: {},
      states: {
        foo: {
          entry: () => {
            executed = true;
          }
        }
      }
    });

    interpret2(machine).start();
    expect(executed).toBe(true);
  });

  it('should lookup string actions in options', () => {
    let executed = false;

    const machine = createMachine(
      {
        initial: 'foo',
        states: {
          foo: {
            entry: 'testAction'
          }
        }
      },
      {
        actions: {
          testAction: () => {
            executed = true;
          }
        }
      }
    );

    interpret(machine).start();

    expect(executed).toBe(true);
  });

  it('should reveal the current state', () => {
    const machine = createMachine2({
      initial: 'test',
      context: { foo: 'bar' },
      states: {
        test: {}
      }
    });
    const service = interpret2(machine);

    service.start();

    expect(service.getSnapshot().value).toEqual('test');
    expect(service.getSnapshot().context).toEqual({ foo: 'bar' });
  });

  it('should reveal the current state after transition', (done) => {
    const machine = createMachine2({
      initial: 'test',
      context: { foo: 'bar' },
      states: {
        test: {
          on: { CHANGE: 'success' }
        },
        success: {}
      }
    });
    const service = interpret2(machine);

    service.start();

    service.subscribe(() => {
      if (service.getSnapshot().value === 'success') {
        done();
      }
    });

    service.send({ type: 'CHANGE' });
  });

  it('should not re-execute exit/entry actions for transitions with undefined targets', () => {
    const machine = createMachine2({
      initial: 'test',
      context: {},
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

      expect(service.state.value).toBe('foo');
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

      const service = interpret(machine).start('bar');
      expect(service.state.value).toBe('bar');

      service.send('NEXT');
      expect(service.state.matches('baz')).toBe(true);
    });

    it('should rehydrate the state and the context if both are provided', () => {
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

      const context = { hello: 'world' };
      const service = interpret(machine).start({ value: 'bar', context });
      expect(service.state.value).toBe('bar');
      expect(service.state.context).toBe(context);

      service.send('NEXT');
      expect(service.state.matches('baz')).toBe(true);
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

describe('new', () => {
  describe('machine', () => {
    it('should transition correctly', () => {
      const machine = createMachine2({
        initial: 'green',
        context: {},
        states: {
          green: {
            on: {
              TIMER: 'yellow'
            }
          },
          yellow: {},
          red: {}
        }
      });

      expect(
        machine.transition(machine.initialState, { type: 'TIMER' }).value
      ).toEqual('yellow');
    });
    it('should stay on the same state when there is no transition for the sent event', () => {
      const machine = createMachine2({
        initial: 'green',
        context: {},
        states: {
          green: {
            on: {
              TIMER: 'yellow'
            }
          },
          yellow: {},
          red: {}
        }
      });

      expect(
        machine.transition(machine.initialState, { type: 'NONEXISTANT' }).value
      ).toEqual('green');
    });
    it('should stay on the same state when there is no transition for the sent event', () => {
      const machine = createMachine2({
        initial: 'green',
        context: {},
        states: {
          green: {
            on: {
              TIMER: 'yellow'
            }
          },
          yellow: {},
          red: {}
        }
      });

      expect(
        machine.transition(machine.initialState, { type: 'NONEXISTANT' }).value
      ).toEqual('green');
    });

    it('should output actions', () => {
      const machine = createMachine2({
        initial: 'green',
        context: { number: 42 },
        states: {
          green: {
            on: {
              TIMER: {
                target: 'yellow',
                actions: 'greenToYellowAction'
              }
            },
            exit: 'greenExit'
          },
          yellow: {
            entry: 'yellowEntry'
          },
          red: {}
        }
      });

      expect(
        machine.transition(machine.initialState, { type: 'TIMER' }).actions
      ).toEqual([
        { type: 'greenExit' },
        { type: 'greenToYellowAction' },
        { type: 'yellowEntry' }
      ]);
    });

    it('should work with guards', () => {
      const machine = createMachine2({
        initial: 'inactive',
        context: { num: 42 },
        states: {
          inactive: {
            on: {
              EVENT: [
                {
                  guard: (ctx) => ctx.num === 10,
                  target: 'fail'
                },
                'active'
              ],
              FOO: {
                guard: (_ctx) => true
              }
            }
          },
          active: {},
          fail: {}
        }
      });

      expect(
        machine.transition(machine.initialState, { type: 'EVENT' }).value
      ).toEqual('active');
    });
  });

  it('should support invokes', (done) => {
    const machine = createMachine2({
      initial: 'idle',
      context: {},
      states: {
        idle: {
          on: {
            NEXT: {
              target: 'loading'
            }
          }
        },
        loading: {
          invoke: {
            id: 'promise',
            src: createPromiseBehavior(
              () =>
                new Promise((res) => {
                  setTimeout(() => {
                    res(42);
                  }, 1000);
                })
            )
          },
          on: {
            'done.invoke.promise': {
              guard: (_, event) => event.data === 42,
              target: 'success'
            }
          }
        },
        success: {}
      }
    });

    const s = interpret2(machine).start();

    s.subscribe((state) => {
      if (state.value === 'success') {
        done();
      }
    });

    s.send({ type: 'NEXT' });
  });

  it('should support invokes with dynamic source', (done) => {
    const machine = createMachine2({
      initial: 'idle',
      context: {},
      states: {
        idle: {
          on: {
            NEXT: {
              target: 'loading'
            }
          }
        },
        loading: {
          invoke: {
            id: 'promise',
            src: () =>
              createPromiseBehavior(
                () =>
                  new Promise((res) => {
                    setTimeout(() => {
                      res(42);
                    }, 1000);
                  })
              )
          },
          on: {
            'done.invoke.promise': {
              guard: (_, event) => event.data === 42,
              target: 'success'
            }
          }
        },
        success: {}
      }
    });

    const s = interpret2(machine).start();

    s.subscribe((state) => {
      if (state.value === 'success') {
        done();
      }
    });

    s.send({ type: 'NEXT' });
  });
});
