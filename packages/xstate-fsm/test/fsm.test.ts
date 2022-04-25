import { createMachine, interpret, assign } from '../src/';
import { fromPromise } from '../src/actors';

describe('@xstate/fsm', () => {
  it('should have the correct initial state and actions', () => {
    const { initialState } = createMachine({
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
        },
        other: {}
      }
    });

    expect(initialState.context).toEqual({ count: 1 });
  });

  it('should transition correctly', () => {
    const fsm = createMachine({
      id: 'light',
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
          entry: assign({ go: false })
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
    const fsm = createMachine({
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
      const fsm = createMachine({
        initial: 'a',
        context: {},
        states: { a: {} }
      });
      fsm.transition(
        // @ts-expect-error
        { value: 'unknown', actions: [] },
        {
          type: 'TIMER'
        }
      );
    }).toThrow();
  });

  it('should throw an error for undefined next state config', () => {
    const invalidState = 'blue';

    const testMachine = createMachine({
      id: 'test',
      context: {},
      initial: 'green',
      states: {
        green: {
          on: {
            // @ts-expect-error
            TARGET_INVALID: invalidState
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
    const fsm = createMachine({
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
              actions: assign({
                count: (ctx, e) => ctx.count + e.value
              })
            }
          }
        },
        active: {
          invoke: {
            id: 'prom',
            src: fromPromise<number>(() => null as any)
          }
        }
      }
    });
    const inactiveState = fsm.transition(fsm.initialState, {
      type: 'EVENT'
    });
    expect(inactiveState.value).toEqual('inactive');

    const incState = fsm.transition(fsm.initialState, {
      type: 'INC',
      value: 5
    });
    const activeState = fsm.transition(incState, { type: 'EVENT' });
    expect(activeState.value).toEqual('active');
  });

  it('should match initialState', () => {
    const { initialState } = createMachine({
      initial: 'green',
      context: {},
      states: {
        green: {}
      }
    });

    expect(initialState.value).toEqual('green');
  });

  it('should match transition states', () => {
    const lightFSM2 = createMachine({
      initial: 'green',
      context: {
        go: true
      },
      states: {
        green: {
          on: { TIMER: 'yellow' }
        },
        yellow: {
          entry: assign({
            go: false
          })
        }
      }
    });
    const nextState = lightFSM2.transition(lightFSM2.initialState, {
      type: 'TIMER'
    });

    expect(nextState.value).toEqual('yellow');

    if (nextState.value === 'yellow') {
      expect(nextState.context.go).toBeFalsy();
    }
  });
});

describe('interpreter', () => {
  it('listeners should immediately get the initial state', (done) => {
    const toggleMachine = createMachine({
      initial: 'active',
      context: {},
      states: {
        active: {
          on: { TOGGLE: 'inactive' }
        },
        inactive: {}
      }
    });
    const toggleService = interpret(toggleMachine).start();

    toggleService.subscribe((state) => {
      if (state.value === 'active') {
        done();
      }
    });
  });

  it('listeners should subscribe to state changes', (done) => {
    const toggleMachine = createMachine({
      initial: 'active',
      context: {},
      states: {
        active: {
          on: { TOGGLE: 'inactive' }
        },
        inactive: {}
      }
    });
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

    const actionService = interpret(actionMachine).start();

    actionService.subscribe(() => {
      if (executed) {
        done();
      }
    });

    actionService.send({ type: 'TOGGLE' });
  });

  describe('`start` method', () => {
    it('should start the service with initial state by default', () => {
      const machine = createMachine({
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

      const service = interpret(machine).start();

      expect(service.getSnapshot().value).toBe('foo');
    });

    it('should rehydrate the state if the state if provided', () => {
      const machine = createMachine({
        initial: 'foo',
        context: {},
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

      const service = interpret(machine).start({
        value: 'bar',
        context: {},
        actions: []
      });
      expect(service.getSnapshot().value).toBe('bar');

      service.send({ type: 'NEXT' });
      expect(service.getSnapshot().value).toEqual('baz');
    });

    it('should rehydrate the state and the context if both are provided', () => {
      const machine = createMachine({
        initial: 'foo',
        context: {},
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
      const service = interpret(machine).start({
        value: 'bar',
        context,
        actions: []
      });
      expect(service.getSnapshot().value).toBe('bar');
      expect(service.getSnapshot().context).toBe(context);

      service.send({ type: 'NEXT' });
      expect(service.getSnapshot().value).toEqual('baz');
    });
  });

  it('should execute initial entry action', () => {
    let executed = false;

    const machine = createMachine({
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

    interpret(machine).start();
    expect(executed).toBe(true);
  });

  it('should lookup string actions in options', () => {
    let executed = false;

    const machine = createMachine(
      {
        initial: 'foo',
        context: {},
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

  it('referenced actions should read context', () => {
    let executed = false;

    const machine = createMachine(
      {
        initial: 'start',
        context: {
          num: 42
        },
        states: {
          start: {
            entry: 'testAction'
          }
        }
      },
      {
        actions: {
          testAction: (ctx) => {
            expect(ctx.num).toEqual(42);
            executed = true;
          }
        }
      }
    );

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

      const service = interpret(machine).start();

      expect(service.getSnapshot().value).toBe('foo');
    });

    it('should rehydrate the state if the state if provided', () => {
      const machine = createMachine({
        initial: 'foo',
        context: {},
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

      const service = interpret(machine).start({
        value: 'bar',
        context: {},
        actions: []
      });
      expect(service.getSnapshot().value).toBe('bar');

      service.send({ type: 'NEXT' });
      expect(service.getSnapshot().value).toEqual('baz');
    });

    it('should rehydrate the state and the context if both are provided', () => {
      const machine = createMachine({
        initial: 'foo',
        context: {},
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
      const service = interpret(machine).start({
        value: 'bar',
        context,
        actions: []
      });
      expect(service.getSnapshot().value).toBe('bar');
      expect(service.getSnapshot().context).toBe(context);

      service.send({ type: 'NEXT' });
      expect(service.getSnapshot().value).toEqual('baz');
    });

    it('should execute initial actions when re-starting a service', () => {
      let entryActionCalled = false;
      const machine = createMachine({
        initial: 'test',
        context: {},
        states: {
          test: {
            entry: () => (entryActionCalled = true)
          }
        }
      });

      const service = interpret(machine).start();
      // service.stop(); // TODO: stop

      entryActionCalled = false;

      service.start();

      expect(entryActionCalled).toBe(true);
    });

    it('should execute initial actions when re-starting a service that transitioned to a different state', () => {
      let entryActionCalled = false;
      const machine = createMachine({
        initial: 'a',
        context: {},
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
      // service.stop(); // TODO: stop

      entryActionCalled = false;

      service.start();

      expect(entryActionCalled).toBe(true);
    });

    it('should not execute actions of the last known non-initial state when re-starting a service', () => {
      let entryActionCalled = false;
      const machine = createMachine({
        initial: 'a',
        context: {},
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
      // service.stop(); // TODO: stop

      entryActionCalled = false;

      service.start();

      expect(entryActionCalled).toBe(false);
    });
  });
});

describe('new', () => {
  describe('machine', () => {
    it('should transition correctly', () => {
      const machine = createMachine({
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
      const machine = createMachine({
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
      const machine = createMachine({
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
      const machine = createMachine({
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
      const machine = createMachine({
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
    const machine = createMachine({
      initial: 'idle',
      context: {
        num: 42
      },
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
            src: fromPromise<number>(
              () =>
                new Promise((res) => {
                  setTimeout(() => {
                    res(42);
                  }, 1000);
                })
            ),
            onDone: {
              guard: (_, event) => event.data === 42,
              target: 'success'
            }
          }
        },
        success: {}
      }
    });

    const s = interpret(machine).start();

    s.subscribe((state) => {
      if (state.value === 'success') {
        done();
      }
    });

    s.send({ type: 'NEXT' });
  });

  it('should support invokes with dynamic source', (done) => {
    const machine = createMachine({
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
              fromPromise(
                () =>
                  new Promise<number>((res) => {
                    setTimeout(() => {
                      res(42);
                    }, 1000);
                  })
              ),
            onDone: {
              guard: (_, event) => event.data === 42,
              target: 'success'
            }
          }
        },
        success: {}
      }
    });

    const s = interpret(machine).start();

    s.subscribe((state) => {
      if (state.value === 'success') {
        done();
      }
    });

    s.send({ type: 'NEXT' });
  });
});

it('type sanity check', () => {
  createMachine({
    context: {
      num: 42
    },
    schema: {
      event: {} as { type: 'EVENT' } | { type: 'WHATEVER' }
    },
    states: {
      red: {},
      green: {
        on: {
          EVENT: 'yellow'
        }
      },
      yellow: {
        entry: assign((ctx) => ({ num: ctx.num + 3 })),
        on: {
          WHATEVER: [
            {
              guard: (ctx) => ctx.num === 42,
              target: 'green'
            }
          ]
        }
      }
    },
    initial: 'green',
    on: {
      EVENT: {
        target: '.red'
      }
    }
  });

  createMachine({
    initial: 'inactive',
    context: { num: 42 },
    states: {
      inactive: {
        entry: assign({ num: 2 }),
        on: {
          EVENT: [
            {
              guard: (ctx) => ctx.num === 20,
              target: 'inactive'
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

  createMachine({
    id: 'light',
    initial: 'green',
    context: { count: 0, foo: 'bar', go: true },
    states: {
      green: {
        entry: 'enterGreen',
        exit: [
          'exitGreen',
          assign({ count: (ctx) => ctx.count + 1 }),
          assign((ctx) => ({ count: ctx.count + 1 })),
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
        entry: assign({ go: false })
      },
      red: {}
    }
  });
});
