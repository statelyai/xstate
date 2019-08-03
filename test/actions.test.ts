import { Machine, assign, interpret } from '../src/index';
import { pure } from '../src/actions';

describe('onEntry/onExit actions', () => {
  const pedestrianStates = {
    initial: 'walk',
    states: {
      walk: {
        on: {
          PED_COUNTDOWN: 'wait'
        },
        entry: 'enter_walk',
        exit: 'exit_walk'
      },
      wait: {
        on: {
          PED_COUNTDOWN: 'stop'
        },
        entry: 'enter_wait',
        exit: 'exit_wait'
      },
      stop: {
        entry: ['enter_stop'],
        exit: ['exit_stop']
      }
    }
  };

  const lightMachine = Machine({
    key: 'light',
    initial: 'green',
    states: {
      green: {
        on: {
          TIMER: 'yellow',
          POWER_OUTAGE: 'red',
          NOTHING: 'green'
        },
        entry: 'enter_green',
        exit: 'exit_green'
      },
      yellow: {
        on: {
          TIMER: 'red',
          POWER_OUTAGE: 'red'
        },
        entry: 'enter_yellow',
        exit: 'exit_yellow'
      },
      red: {
        on: {
          TIMER: 'green',
          POWER_OUTAGE: 'red',
          NOTHING: 'red'
        },
        entry: 'enter_red',
        exit: 'exit_red',
        ...pedestrianStates
      }
    }
  });

  const newPedestrianStates = {
    initial: 'walk',
    states: {
      walk: {
        on: {
          PED_COUNTDOWN: 'wait'
        },
        entry: 'enter_walk',
        exit: 'exit_walk'
      },
      wait: {
        on: {
          PED_COUNTDOWN: 'stop'
        },
        entry: 'enter_wait',
        exit: 'exit_wait'
      },
      stop: {
        entry: ['enter_stop'],
        exit: ['exit_stop']
      }
    }
  };

  const newLightMachine = Machine({
    key: 'light',
    initial: 'green',
    states: {
      green: {
        on: {
          TIMER: 'yellow',
          POWER_OUTAGE: 'red',
          NOTHING: 'green'
        },
        entry: 'enter_green',
        exit: 'exit_green'
      },
      yellow: {
        on: {
          TIMER: 'red',
          POWER_OUTAGE: 'red'
        },
        entry: 'enter_yellow',
        exit: 'exit_yellow'
      },
      red: {
        on: {
          TIMER: 'green',
          POWER_OUTAGE: 'red',
          NOTHING: 'red'
        },
        entry: 'enter_red',
        exit: 'exit_red',
        ...newPedestrianStates
      }
    }
  });

  const parallelMachine = Machine({
    type: 'parallel',
    states: {
      a: {
        initial: 'a1',
        states: {
          a1: {
            on: {
              CHANGE: { target: 'a2', actions: ['do_a2', 'another_do_a2'] }
            },
            entry: 'enter_a1',
            exit: 'exit_a1'
          },
          a2: { entry: 'enter_a2', exit: 'exit_a2' }
        },
        entry: 'enter_a',
        exit: 'exit_a'
      },
      b: {
        initial: 'b1',
        states: {
          b1: {
            on: { CHANGE: { target: 'b2', actions: 'do_b2' } },
            entry: 'enter_b1',
            exit: 'exit_b1'
          },
          b2: { entry: 'enter_b2', exit: 'exit_b2' }
        },
        entry: 'enter_b',
        exit: 'exit_b'
      }
    }
  });

  const deepMachine = Machine({
    initial: 'a',
    states: {
      a: {
        initial: 'a1',
        states: {
          a1: {
            on: {
              NEXT: 'a2',
              NEXT_FN: 'a3'
            },
            entry: 'enter_a1',
            exit: 'exit_a1'
          },
          a2: {
            entry: 'enter_a2',
            exit: 'exit_a2'
          },
          a3: {
            on: {
              NEXT: {
                target: 'a2',
                actions: [
                  function do_a3_to_a2() {
                    return;
                  }
                ]
              }
            },
            entry: function enter_a3_fn() {
              return;
            },
            exit: function exit_a3_fn() {
              return;
            }
          }
        },
        entry: 'enter_a',
        exit: ['exit_a', 'another_exit_a'],
        on: { CHANGE: 'b' }
      },
      b: {
        entry: ['enter_b', 'another_enter_b'],
        exit: 'exit_b',
        initial: 'b1',
        states: {
          b1: {
            entry: 'enter_b1',
            exit: 'exit_b1'
          }
        }
      }
    }
  });

  const parallelMachine2 = Machine({
    initial: 'A',
    states: {
      A: {
        on: {
          'to-B': 'B'
        }
      },
      B: {
        type: 'parallel',
        on: {
          'to-A': 'A'
        },
        states: {
          C: {
            initial: 'C1',
            states: {
              C1: {},
              C2: {}
            }
          },
          D: {
            initial: 'D1',
            states: {
              D1: {
                on: {
                  'to-D2': 'D2'
                }
              },
              D2: {
                entry: ['D2 Entry'],
                exit: ['D2 Exit']
              }
            }
          }
        }
      }
    }
  });

  describe('State.actions', () => {
    it('should return the entry actions of an initial state', () => {
      expect(lightMachine.initialState.actions.map(a => a.type)).toEqual([
        'enter_green'
      ]);
    });

    it('should return the entry actions of an initial state (deep)', () => {
      expect(deepMachine.initialState.actions.map(a => a.type)).toEqual([
        'enter_a',
        'enter_a1'
      ]);
    });

    it('should return the entry actions of an initial state (parallel)', () => {
      expect(parallelMachine.initialState.actions.map(a => a.type)).toEqual([
        'enter_a',
        'enter_a1',
        'enter_b',
        'enter_b1'
      ]);
    });

    it('should return the entry and exit actions of a transition', () => {
      expect(lightMachine.transition('green', 'TIMER').actions.map(a => a.type)).toEqual(['exit_green', 'enter_yellow']);
    });

    it('should return the entry and exit actions of a deep transition', () => {
      expect(lightMachine.transition('yellow', 'TIMER').actions.map(a => a.type)).toEqual(['exit_yellow', 'enter_red', 'enter_walk']);
    });

    it('should return the entry and exit actions of a nested transition', () => {
      expect(lightMachine
        .transition('red.walk', 'PED_COUNTDOWN')
        .actions.map(a => a.type)).toEqual(['exit_walk', 'enter_wait']);
    });

    it('should not have actions for unhandled events (shallow)', () => {
      expect(lightMachine.transition('green', 'FAKE').actions.map(a => a.type)).toEqual([]);
    });

    it('should not have actions for unhandled events (deep)', () => {
      expect(lightMachine.transition('red', 'FAKE').actions.map(a => a.type)).toEqual([]);
    });

    it('should exit and enter the state for self-transitions (shallow)', () => {
      expect(lightMachine.transition('green', 'NOTHING').actions.map(a => a.type)).toEqual(['exit_green', 'enter_green']);
    });

    it('should exit and enter the state for self-transitions (deep)', () => {
      // 'red' state resolves to 'red.walk'
      expect(lightMachine.transition('red', 'NOTHING').actions.map(a => a.type)).toEqual(['exit_walk', 'exit_red', 'enter_red', 'enter_walk']);
    });

    it('should return actions for parallel machines', () => {
      expect(
        parallelMachine
          .transition(parallelMachine.initialState, 'CHANGE')
          .actions.map(a => a.type)
      )
      .toEqual(
        [
          'exit_b1', // reverse document order
          'exit_a1',
          'do_a2',
          'another_do_a2',
          'do_b2',
          'enter_a2',
          'enter_b2'
        ]
      );
    });

    it('should return nested actions in the correct (child to parent) order', () => {
      expect(deepMachine.transition('a.a1', 'CHANGE').actions.map(a => a.type)).toEqual([
        'exit_a1',
        'exit_a',
        'another_exit_a',
        'enter_b',
        'another_enter_b',
        'enter_b1'
      ]);
    });

    it('should ignore parent state actions for same-parent substates', () => {
      expect(deepMachine.transition('a.a1', 'NEXT').actions.map(a => a.type)).toEqual(['exit_a1', 'enter_a2']);
    });

    it('should work with function actions', () => {
      expect(deepMachine
        .transition(deepMachine.initialState, 'NEXT_FN')
        .actions.map(action => action.type)).toEqual(['exit_a1', 'enter_a3_fn']);

      expect(deepMachine
        .transition('a.a3', 'NEXT')
        .actions.map(action => action.type)).toEqual(['exit_a3_fn', 'do_a3_to_a2', 'enter_a2']);
    });

    it('should exit children of parallel state nodes', () => {
      const stateB = parallelMachine2.transition(
        parallelMachine2.initialState,
        'to-B'
      );
      const stateD2 = parallelMachine2.transition(stateB, 'to-D2');
      const stateA = parallelMachine2.transition(stateD2, 'to-A');

      expect(stateA.actions.map(action => action.type)).toEqual(['D2 Exit']);
    });

    describe('should ignore same-parent state actions (sparse)', () => {
      const fooBar = {
        initial: 'foo',
        states: {
          foo: {
            on: {
              TACK: 'bar',
              ABSOLUTE_TACK: '#machine.ping.bar'
            }
          },
          bar: {
            on: {
              TACK: 'foo'
            }
          }
        }
      };

      const pingPong = Machine({
        initial: 'ping',
        key: 'machine',
        states: {
          ping: {
            entry: ['entryEvent'],
            on: {
              TICK: 'pong'
            },
            ...fooBar
          },
          pong: {
            on: {
              TICK: 'ping'
            }
          }
        }
      });

      it('with a relative transition', () => {
        expect(pingPong.transition('ping.foo', 'TACK').actions).toHaveLength(0);
      });

      it('with an absolute transition', () => {
        expect(pingPong.transition('ping.foo', 'ABSOLUTE_TACK').actions)
          .toHaveLength(0);
      });
    });
  });

  describe('State.actions (with entry/exit instead of onEntry/onExit)', () => {
    it('should return the entry actions of an initial state', () => {
      expect(newLightMachine.initialState.actions.map(a => a.type)).toEqual(['enter_green']);
    });

    it('should return the entry and exit actions of a transition', () => {
      expect(newLightMachine.transition('green', 'TIMER').actions.map(a => a.type)).toEqual(['exit_green', 'enter_yellow']);
    });

    it('should return the entry and exit actions of a deep transition', () => {
      expect(newLightMachine.transition('yellow', 'TIMER').actions.map(a => a.type)).toEqual(['exit_yellow', 'enter_red', 'enter_walk']);
    });

    it('should return the entry and exit actions of a nested transition', () => {
      expect(newLightMachine
        .transition('red.walk', 'PED_COUNTDOWN')
        .actions.map(a => a.type)).toEqual(['exit_walk', 'enter_wait']);
    });

    it('should not have actions for unhandled events (shallow)', () => {
      expect(newLightMachine.transition('green', 'FAKE').actions.map(a => a.type)).toEqual([]);
    });

    it('should not have actions for unhandled events (deep)', () => {
      expect(newLightMachine.transition('red', 'FAKE').actions.map(a => a.type)).toEqual([]);
    });

    it('should exit and enter the state for self-transitions (shallow)', () => {
      expect(newLightMachine.transition('green', 'NOTHING').actions.map(a => a.type)).toEqual(['exit_green', 'enter_green']);
    });

    it('should exit and enter the state for self-transitions (deep)', () => {
      // 'red' state resolves to 'red.walk'
      expect(newLightMachine.transition('red', 'NOTHING').actions.map(a => a.type)).toEqual(['exit_walk', 'exit_red', 'enter_red', 'enter_walk']);
    });
  });

  describe('parallel states', () => {
    it('should return entry action defined on parallel state', () => {
      const parallelMachineWithOnEntry = Machine({
        id: 'fetch',
        context: { attempts: 0 },
        initial: 'start',
        states: {
          start: {
            on: { ENTER_PARALLEL: 'p1' }
          },
          p1: {
            type: 'parallel',
            entry: 'enter_p1',
            states: {
              nested: {
                initial: 'inner',
                states: {
                  inner: {
                    entry: 'enter_inner'
                  }
                }
              }
            }
          }
        }
      });

      expect(parallelMachineWithOnEntry
        .transition('start', 'ENTER_PARALLEL')
        .actions.map(a => a.type)).toEqual(['enter_p1', 'enter_inner']);
    });
  });

  describe('targetless transitions', () => {
    it("shouldn't exit a state on a parent's targetless transition", done => {
      const actual: string[] = [];

      const parent = Machine({
        initial: 'one',
        on: {
          WHATEVER: {
            actions: () => {
              actual.push('got WHATEVER');
            }
          }
        },
        states: {
          one: {
            entry: () => {
              actual.push('entered one');
            },
            on: {
              '': 'two'
            }
          },
          two: {
            exit: () => {
              actual.push('exitted two');
            }
          }
        }
      });

      const service = interpret(parent).start();

      Promise.resolve()
        .then(() => {
          service.send('WHATEVER');
        })
        .then(() => {
          expect(actual).toEqual(['entered one', 'got WHATEVER']);
          done();
        })
        .catch(done);
    });
  });
});

describe('actions on invalid transition', () => {
  const stopMachine = Machine({
    initial: 'idle',
    states: {
      idle: {
        on: {
          STOP: {
            target: 'stop',
            actions: ['action1']
          }
        }
      },
      stop: {}
    }
  });

  it('should not recall previous actions', () => {
    const nextState = stopMachine.transition('idle', 'STOP');
    expect(stopMachine.transition(nextState, 'INVALID').actions).toHaveLength(0);
  });
});

describe('actions config', () => {
  type EventType =
    | { type: 'definedAction' }
    | { type: 'updateContext' }
    | { type: 'EVENT' }
    | { type: 'E' };
  interface Context {
    count: number;
  }
  interface State {
    states: {
      a: {};
      b: {};
    };
  }

  // tslint:disable-next-line:no-empty
  const definedAction = () => {};
  const simpleMachine = Machine<Context, State, EventType>(
    {
      initial: 'a',
      context: {
        count: 0
      },
      states: {
        a: {
          entry: [
            'definedAction',
            { type: 'definedAction' },
            'undefinedAction'
          ],
          on: {
            EVENT: {
              target: 'b',
              actions: [{ type: 'definedAction' }, { type: 'updateContext' }]
            }
          }
        },
        b: {}
      },
      on: {
        E: 'a'
      }
    },
    {
      actions: {
        definedAction,
        updateContext: assign({ count: 10 })
      }
    }
  );
  it('should reference actions defined in actions parameter of machine options', () => {
    const { initialState } = simpleMachine;
    const nextState = simpleMachine.transition(initialState, 'E');

    expect(nextState.actions.map(a => a.type)).toEqual(expect.arrayContaining([
      'definedAction',
      'undefinedAction'
    ]));

    expect(nextState.actions).toEqual([
      { type: 'definedAction', exec: definedAction },
      { type: 'definedAction', exec: definedAction },
      { type: 'undefinedAction', exec: undefined }
    ]);
  });

  it('should reference actions defined in actions parameter of machine options (initial state)', () => {
    const { initialState } = simpleMachine;

    expect(initialState.actions.map(a => a.type)).toEqual(expect.arrayContaining([
      'definedAction',
      'undefinedAction'
    ]));
  });

  it('should be able to reference action implementations from action objects', () => {
    const state = simpleMachine.transition('a', 'EVENT');

    expect(state.actions).toEqual([
      { type: 'definedAction', exec: definedAction }
    ]);

    expect(state.context).toEqual({ count: 10 });
  });

  it('should work with anonymous functions (with warning)', () => {
    let onEntryCalled = false;
    let actionCalled = false;
    let onExitCalled = false;

    const anonMachine = Machine({
      id: 'anon',
      initial: 'active',
      states: {
        active: {
          entry: () => (onEntryCalled = true),
          exit: () => (onExitCalled = true),
          on: {
            EVENT: {
              target: 'inactive',
              actions: [() => (actionCalled = true)]
            }
          }
        },
        inactive: {}
      }
    });

    const { initialState } = anonMachine;

    initialState.actions.forEach(action => {
      if (action.exec) {
        action.exec(
          initialState.context,
          { type: 'any' },
          {
            action,
            state: initialState,
            _event: initialState._event
          }
        );
      }
    });

    expect(onEntryCalled).toBe(true);

    const inactiveState = anonMachine.transition(initialState, 'EVENT');

    expect(inactiveState.actions.length).toBe(2);

    inactiveState.actions.forEach(action => {
      if (action.exec) {
        action.exec(
          inactiveState.context,
          { type: 'EVENT' },
          {
            action,
            state: initialState,
            _event: initialState._event
          }
        );
      }
    });

    expect(onExitCalled).toBe(true);
    expect(actionCalled).toBe(true);
  });
});

describe('action meta', () => {
  it('should provide the original action and state to the exec function', done => {
    const testMachine = Machine(
      {
        id: 'test',
        initial: 'foo',
        states: {
          foo: {
            entry: {
              type: 'entryAction',
              value: 'something'
            }
          }
        }
      },
      {
        actions: {
          entryAction: (_, __, meta) => {
            expect(meta.state.value).toEqual('foo');
            expect(meta.action.type).toEqual('entryAction');
            expect(meta.action.value).toEqual('something');
            done();
          }
        }
      }
    );

    interpret(testMachine).start();
  });
});

describe('purely defined actions', () => {
  const dynamicMachine = Machine({
    id: 'dynamic',
    initial: 'idle',
    context: {
      items: [{ id: 1 }, { id: 2 }, { id: 3 }]
    },
    states: {
      idle: {
        on: {
          SINGLE: {
            actions: pure<any, any>((ctx, e) => {
              if (ctx.items.length > 0) {
                return {
                  type: 'SINGLE_EVENT',
                  length: ctx.items.length,
                  id: e.id
                };
              }
            })
          },
          NONE: {
            actions: pure<any, any>((ctx, e) => {
              if (ctx.items.length > 5) {
                return {
                  type: 'SINGLE_EVENT',
                  length: ctx.items.length,
                  id: e.id
                };
              }
            })
          },
          EACH: {
            actions: pure<any, any>(ctx =>
              ctx.items.map((item, index) => ({ type: 'EVENT', item, index }))
            )
          }
        }
      }
    }
  });

  it('should allow for a purely defined dynamic action', () => {
    const nextState = dynamicMachine.transition(dynamicMachine.initialState, {
      type: 'SINGLE',
      id: 3
    });

    expect(nextState.actions).toEqual([
      { type: 'SINGLE_EVENT', length: 3, id: 3 }
    ]);
  });

  it('should allow for purely defined lack of actions', () => {
    const nextState = dynamicMachine.transition(dynamicMachine.initialState, {
      type: 'NONE',
      id: 3
    });

    expect(nextState.actions).toEqual([]);
  });

  it('should allow for purely defined dynamic actions', () => {
    const nextState = dynamicMachine.transition(
      dynamicMachine.initialState,
      'EACH'
    );

    expect(nextState.actions).toEqual([
      { type: 'EVENT', item: { id: 1 }, index: 0 },
      { type: 'EVENT', item: { id: 2 }, index: 1 },
      { type: 'EVENT', item: { id: 3 }, index: 2 }
    ]);
  });
});
