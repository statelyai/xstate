import {
  Machine,
  createMachine,
  assign,
  forwardTo,
  interpret,
  spawn,
  ActorRefFrom,
  AnyStateMachine,
  StateNode,
  actions,
  pure,
  sendParent,
  log,
  choose,
  sendTo,
  stop,
  send,
  raise
} from '../src/index';

const seen = new WeakSet<AnyStateMachine>();

function trackEntries(machine: AnyStateMachine) {
  if (seen.has(machine)) {
    throw new Error(`This helper can't accept the same machine more than once`);
  }
  seen.add(machine);

  let logs: string[] = [];

  function addTrackingActions(
    state: StateNode<any, any, any, any, any, any>,
    stateDescription: string
  ) {
    state.onEntry.unshift({
      type: '__testEntryTracker',
      exec: () => logs.push(`enter: ${stateDescription}`)
    } as any);
    state.onExit.unshift({
      type: '__testExitTracker',
      exec: () => logs.push(`exit: ${stateDescription}`)
    } as any);
  }

  function addTrackingActionsRecursively(
    state: StateNode<any, any, any, any, any, any>
  ) {
    for (const child of Object.values(state.states)) {
      addTrackingActions(child, child.path.join('.'));
      addTrackingActionsRecursively(child);
    }
  }

  addTrackingActions(machine as any, `__root__`);
  addTrackingActionsRecursively(machine as any);

  return () => {
    const flushed = logs;
    logs = [];
    return flushed;
  };
}

describe('entry/exit actions', () => {
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
      expect(lightMachine.initialState.actions.map((a) => a.type)).toEqual([
        'enter_green'
      ]);
    });

    it('should return the entry actions of an initial state (deep)', () => {
      expect(deepMachine.initialState.actions.map((a) => a.type)).toEqual([
        'enter_a',
        'enter_a1'
      ]);
    });

    it('should return the entry actions of an initial state (parallel)', () => {
      expect(parallelMachine.initialState.actions.map((a) => a.type)).toEqual([
        'enter_a',
        'enter_a1',
        'enter_b',
        'enter_b1'
      ]);
    });

    it('should return the entry and exit actions of a transition', () => {
      expect(
        lightMachine.transition('green', 'TIMER').actions.map((a) => a.type)
      ).toEqual(['exit_green', 'enter_yellow']);
    });

    it('should return the entry and exit actions of a deep transition', () => {
      expect(
        lightMachine.transition('yellow', 'TIMER').actions.map((a) => a.type)
      ).toEqual(['exit_yellow', 'enter_red', 'enter_walk']);
    });

    it('should return the entry and exit actions of a nested transition', () => {
      expect(
        lightMachine
          .transition('red.walk', 'PED_COUNTDOWN')
          .actions.map((a) => a.type)
      ).toEqual(['exit_walk', 'enter_wait']);
    });

    it('should not have actions for unhandled events (shallow)', () => {
      expect(
        lightMachine.transition('green', 'FAKE').actions.map((a) => a.type)
      ).toEqual([]);
    });

    it('should not have actions for unhandled events (deep)', () => {
      expect(
        lightMachine.transition('red', 'FAKE').actions.map((a) => a.type)
      ).toEqual([]);
    });

    it('should exit and enter the state for self-transitions (shallow)', () => {
      expect(
        lightMachine.transition('green', 'NOTHING').actions.map((a) => a.type)
      ).toEqual(['exit_green', 'enter_green']);
    });

    it('should exit and enter the state for self-transitions (deep)', () => {
      // 'red' state resolves to 'red.walk'
      expect(
        lightMachine.transition('red', 'NOTHING').actions.map((a) => a.type)
      ).toEqual(['exit_walk', 'exit_red', 'enter_red', 'enter_walk']);
    });

    it('should return actions for parallel machines', () => {
      expect(
        parallelMachine
          .transition(parallelMachine.initialState, 'CHANGE')
          .actions.map((a) => a.type)
      ).toEqual([
        'exit_b1', // reverse document order
        'exit_a1',
        'do_a2',
        'another_do_a2',
        'do_b2',
        'enter_a2',
        'enter_b2'
      ]);
    });

    it('should return nested actions in the correct (child to parent) order', () => {
      expect(
        deepMachine.transition('a.a1', 'CHANGE').actions.map((a) => a.type)
      ).toEqual([
        'exit_a1',
        'exit_a',
        'another_exit_a',
        'enter_b',
        'another_enter_b',
        'enter_b1'
      ]);
    });

    it('should ignore parent state actions for same-parent substates', () => {
      expect(
        deepMachine.transition('a.a1', 'NEXT').actions.map((a) => a.type)
      ).toEqual(['exit_a1', 'enter_a2']);
    });

    it('should work with function actions', () => {
      expect(
        deepMachine
          .transition(deepMachine.initialState, 'NEXT_FN')
          .actions.map((action) => action.type)
      ).toEqual(['exit_a1', 'enter_a3_fn']);

      expect(
        deepMachine
          .transition('a.a3', 'NEXT')
          .actions.map((action) => action.type)
      ).toEqual(['exit_a3_fn', 'do_a3_to_a2', 'enter_a2']);
    });

    it('should exit children of parallel state nodes', () => {
      const stateB = parallelMachine2.transition(
        parallelMachine2.initialState,
        'to-B'
      );
      const stateD2 = parallelMachine2.transition(stateB, 'to-D2');
      const stateA = parallelMachine2.transition(stateD2, 'to-A');

      expect(stateA.actions.map((action) => action.type)).toEqual(['D2 Exit']);
    });

    it("should reenter targeted ancestor (as it's a descendant of the transition domain)", () => {
      const machine = createMachine({
        initial: 'loaded',
        states: {
          loaded: {
            id: 'loaded',
            initial: 'idle',
            states: {
              idle: {
                on: {
                  UPDATE: '#loaded'
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const service = interpret(machine).start();

      flushTracked();
      service.send('UPDATE');

      expect(flushTracked()).toEqual([
        'exit: loaded.idle',
        'exit: loaded',
        'enter: loaded',
        'enter: loaded.idle'
      ]);
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

      const pingPong = createMachine({
        initial: 'ping',
        id: 'machine',
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
        expect(
          pingPong.transition('ping.foo', 'ABSOLUTE_TACK').actions
        ).toHaveLength(0);
      });
    });
  });

  describe('State.actions (with entry/exit instead of onEntry/onExit)', () => {
    it('should return the entry actions of an initial state', () => {
      expect(newLightMachine.initialState.actions.map((a) => a.type)).toEqual([
        'enter_green'
      ]);
    });

    it('should return the entry and exit actions of a transition', () => {
      expect(
        newLightMachine.transition('green', 'TIMER').actions.map((a) => a.type)
      ).toEqual(['exit_green', 'enter_yellow']);
    });

    it('should return the entry and exit actions of a deep transition', () => {
      expect(
        newLightMachine.transition('yellow', 'TIMER').actions.map((a) => a.type)
      ).toEqual(['exit_yellow', 'enter_red', 'enter_walk']);
    });

    it('should return the entry and exit actions of a nested transition', () => {
      expect(
        newLightMachine
          .transition('red.walk', 'PED_COUNTDOWN')
          .actions.map((a) => a.type)
      ).toEqual(['exit_walk', 'enter_wait']);
    });

    it('should not have actions for unhandled events (shallow)', () => {
      expect(
        newLightMachine.transition('green', 'FAKE').actions.map((a) => a.type)
      ).toEqual([]);
    });

    it('should not have actions for unhandled events (deep)', () => {
      expect(
        newLightMachine.transition('red', 'FAKE').actions.map((a) => a.type)
      ).toEqual([]);
    });

    it('should exit and enter the state for self-transitions (shallow)', () => {
      expect(
        newLightMachine
          .transition('green', 'NOTHING')
          .actions.map((a) => a.type)
      ).toEqual(['exit_green', 'enter_green']);
    });

    it('should exit and enter the state for self-transitions (deep)', () => {
      // 'red' state resolves to 'red.walk'
      expect(
        newLightMachine.transition('red', 'NOTHING').actions.map((a) => a.type)
      ).toEqual(['exit_walk', 'exit_red', 'enter_red', 'enter_walk']);
    });

    it('should exit current node and enter target node when target is not a descendent or ancestor of current', () => {
      const machine = createMachine({
        initial: 'A',
        states: {
          A: {
            initial: 'A1',
            states: {
              A1: {
                on: {
                  NEXT: '#sibling_descendant'
                }
              },
              A2: {
                initial: 'A2_child',
                states: {
                  A2_child: {
                    id: 'sibling_descendant'
                  }
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const service = interpret(machine).start({ A: 'A1' });
      service.send({ type: 'NEXT' });

      expect(flushTracked()).toEqual([
        'exit: A.A1',
        'enter: A.A2',
        'enter: A.A2.A2_child'
      ]);
    });

    it('should exit current node and reenter target node when target is ancestor of current', () => {
      const machine = createMachine({
        initial: 'A',
        states: {
          A: {
            id: 'ancestor',
            initial: 'A1',
            states: {
              A1: {
                on: {
                  NEXT: 'A2'
                }
              },
              A2: {
                initial: 'A2_child',
                states: {
                  A2_child: {
                    on: {
                      NEXT: '#ancestor'
                    }
                  }
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const service = interpret(machine).start();
      service.send({ type: 'NEXT' });

      flushTracked();
      service.send({ type: 'NEXT' });

      expect(flushTracked()).toEqual([
        'exit: A.A2.A2_child',
        'exit: A.A2',
        'exit: A',
        'enter: A',
        'enter: A.A1'
      ]);
    });

    it('should enter all descendents when target is a descendent of current', () => {
      const machine = createMachine({
        initial: 'A',
        states: {
          A: {
            initial: 'A1',
            on: {
              NEXT: {
                internal: false,
                target: '.A2'
              }
            },
            states: {
              A1: {},
              A2: {
                initial: 'A2a',
                states: {
                  A2a: {}
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const service = interpret(machine).start();
      flushTracked();
      service.send({ type: 'NEXT' });

      expect(flushTracked()).toEqual([
        'exit: A.A1',
        'exit: A',
        'enter: A',
        'enter: A.A2',
        'enter: A.A2.A2a'
      ]);
    });

    it('should exit deep descendant during a self-transition', () => {
      const m = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EV: 'a'
            },
            initial: 'a1',
            states: {
              a1: {
                initial: 'a11',
                states: {
                  a11: {}
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(m);

      const service = interpret(m).start();

      flushTracked();
      service.send('EV');

      expect(flushTracked()).toEqual([
        'exit: a.a1.a11',
        'exit: a.a1',
        'exit: a',
        'enter: a',
        'enter: a.a1',
        'enter: a.a1.a11'
      ]);
    });

    it('should reenter leaf state during its self-transition', () => {
      const m = createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'a1',
            states: {
              a1: {
                on: {
                  EV: 'a1'
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(m);

      const service = interpret(m).start();

      flushTracked();
      service.send('EV');

      expect(flushTracked()).toEqual(['exit: a.a1', 'enter: a.a1']);
    });

    it('should not enter exited state when targeting its ancestor and when its former descendant gets selected through initial state', () => {
      const m = createMachine({
        initial: 'a',
        states: {
          a: {
            id: 'parent',
            initial: 'a1',
            states: {
              a1: {
                on: {
                  EV: 'a2'
                }
              },
              a2: {
                on: {
                  EV: '#parent'
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(m);

      const service = interpret(m).start();
      service.send('EV');

      flushTracked();
      service.send('EV');

      expect(flushTracked()).toEqual([
        'exit: a.a2',
        'exit: a',
        'enter: a',
        'enter: a.a1'
      ]);
    });

    it('should not enter exited state when targeting its ancestor and when its latter descendant gets selected through initial state', () => {
      const m = createMachine({
        initial: 'a',
        states: {
          a: {
            id: 'parent',
            initial: 'a2',
            states: {
              a1: {
                on: {
                  EV: '#parent'
                }
              },
              a2: {
                on: {
                  EV: 'a1'
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(m);

      const service = interpret(m).start();
      service.send('EV');

      flushTracked();
      service.send('EV');

      expect(flushTracked()).toEqual([
        'exit: a.a1',
        'exit: a',
        'enter: a',
        'enter: a.a2'
      ]);
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

      expect(
        parallelMachineWithOnEntry
          .transition('start', 'ENTER_PARALLEL')
          .actions.map((a) => a.type)
      ).toEqual(['enter_p1', 'enter_inner']);
    });

    it('should reenter parallel region when a parallel state gets reentered while targeting another region', () => {
      const machine = createMachine({
        initial: 'ready',
        states: {
          ready: {
            type: 'parallel',
            on: {
              FOO: '#cameraOff'
            },
            states: {
              devicesInfo: {},
              camera: {
                initial: 'on',
                states: {
                  on: {},
                  off: {
                    id: 'cameraOff'
                  }
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const service = interpret(machine).start();

      flushTracked();
      service.send('FOO');

      expect(flushTracked()).toEqual([
        'exit: ready.camera.on',
        'exit: ready.camera',
        'exit: ready.devicesInfo',
        'exit: ready',
        'enter: ready',
        'enter: ready.devicesInfo',
        'enter: ready.camera',
        'enter: ready.camera.off'
      ]);
    });
  });

  describe('targetless transitions', () => {
    it("shouldn't exit a state on a parent's targetless transition", () => {
      const parent = Machine({
        initial: 'one',
        on: {
          WHATEVER: {
            actions: () => {}
          }
        },
        states: {
          one: {}
        }
      });

      const flushTracked = trackEntries(parent);

      const service = interpret(parent).start();

      flushTracked();
      service.send('WHATEVER');

      expect(flushTracked()).toEqual([]);
    });

    it("shouldn't exit (and reenter) state on targetless delayed transition", (done) => {
      const machine = Machine({
        initial: 'one',
        states: {
          one: {
            after: {
              10: {
                actions: () => {
                  // do smth
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      interpret(machine).start();
      flushTracked();

      setTimeout(() => {
        expect(flushTracked()).toEqual([]);
        done();
      }, 50);
    });
  });

  describe('when reaching a final state', () => {
    // https://github.com/statelyai/xstate/issues/1109
    it('exit actions should be called when invoked machine reaches its final state', (done) => {
      let exitCalled = false;
      let childExitCalled = false;
      const childMachine = Machine({
        exit: () => {
          exitCalled = true;
        },
        initial: 'a',
        states: {
          a: {
            type: 'final',
            exit: () => {
              childExitCalled = true;
            }
          }
        }
      });

      const parentMachine = Machine({
        initial: 'active',
        states: {
          active: {
            invoke: {
              src: childMachine,
              onDone: 'finished'
            }
          },
          finished: {
            type: 'final'
          }
        }
      });

      interpret(parentMachine)
        .onDone(() => {
          expect(exitCalled).toBeTruthy();
          expect(childExitCalled).toBeTruthy();
          done();
        })
        .start();
    });
  });

  describe('when stopped', () => {
    it('exit actions should be called when stopping a machine', () => {
      let exitCalled = false;
      let childExitCalled = false;

      const machine = Machine({
        exit: () => {
          exitCalled = true;
        },
        initial: 'a',
        states: {
          a: {
            exit: () => {
              childExitCalled = true;
            }
          }
        }
      });

      const service = interpret(machine).start();
      service.stop();

      expect(exitCalled).toBeTruthy();
      expect(childExitCalled).toBeTruthy();
    });

    it('should call each exit handler only once when the service gets stopped', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'a1',
            states: {
              a1: {}
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const service = interpret(machine).start();

      flushTracked();
      service.stop();

      expect(flushTracked()).toEqual([
        'exit: a.a1',
        'exit: a',
        'exit: __root__'
      ]);
    });

    it('should call exit actions in reversed document order when the service gets stopped', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EV: {
                // just a noop action to ensure that a transition is selected when we send an event
                actions: () => {}
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const service = interpret(machine).start();

      // it's important to send an event here that results in a transition that computes new `state.configuration`
      // and that could impact the order in which exit actions are called
      service.send({ type: 'EV' });
      flushTracked();
      service.stop();

      expect(flushTracked()).toEqual(['exit: a', 'exit: __root__']);
    });

    it('should call exit actions of parallel states in reversed document order when the service gets stopped after earlier region transition', () => {
      const machine = createMachine({
        type: 'parallel',
        states: {
          a: {
            initial: 'child_a',
            states: {
              child_a: {
                on: {
                  EV: {
                    // just a noop action to ensure that a transition is selected when we send an event
                    actions: () => {}
                  }
                }
              }
            }
          },
          b: {
            initial: 'child_b',
            states: {
              child_b: {}
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const service = interpret(machine).start();

      // it's important to send an event here that results in a transition as that computes new `state.configuration`
      // and that could impact the order in which exit actions are called
      service.send({ type: 'EV' });
      flushTracked();
      service.stop();

      expect(flushTracked()).toEqual([
        'exit: b.child_b',
        'exit: b',
        'exit: a.child_a',
        'exit: a',
        'exit: __root__'
      ]);
    });

    it('should call exit actions of parallel states in reversed document order when the service gets stopped after later region transition', () => {
      const machine = createMachine({
        type: 'parallel',
        states: {
          a: {
            initial: 'child_a',
            states: {
              child_a: {}
            }
          },
          b: {
            initial: 'child_b',
            states: {
              child_b: {
                on: {
                  EV: {
                    // just a noop action to ensure that a transition is selected when we send an event
                    actions: () => {}
                  }
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const service = interpret(machine).start();

      // it's important to send an event here that results in a transition as that computes new `state.configuration`
      // and that could impact the order in which exit actions are called
      service.send({ type: 'EV' });
      flushTracked();
      service.stop();

      expect(flushTracked()).toEqual([
        'exit: b.child_b',
        'exit: b',
        'exit: a.child_a',
        'exit: a',
        'exit: __root__'
      ]);
    });

    it('should call exit actions of parallel states in reversed document order when the service gets stopped after multiple regions transition', () => {
      const machine = createMachine({
        type: 'parallel',
        states: {
          a: {
            initial: 'child_a',
            states: {
              child_a: {
                on: {
                  EV: {
                    // just a noop action to ensure that a transition is selected when we send an event
                    actions: () => {}
                  }
                }
              }
            }
          },
          b: {
            initial: 'child_b',
            states: {
              child_b: {
                on: {
                  EV: {
                    // just a noop action to ensure that a transition is selected when we send an event
                    actions: () => {}
                  }
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const service = interpret(machine).start();
      // it's important to send an event here that results in a transition as that computes new `state.configuration`
      // and that could impact the order in which exit actions are called
      service.send({ type: 'EV' });
      flushTracked();
      service.stop();

      expect(flushTracked()).toEqual([
        'exit: b.child_b',
        'exit: b',
        'exit: a.child_a',
        'exit: a',
        'exit: __root__'
      ]);
    });

    it('an exit action executed when an interpreter gets stopped should receive `xstate.stop` event', () => {
      let receivedEvent;
      const machine = createMachine({
        exit: (_ctx, ev) => {
          receivedEvent = ev;
        }
      });

      const service = interpret(machine).start();
      service.stop();

      expect(receivedEvent).toEqual({ type: 'xstate.stop' });
    });

    it('an exit action executed when an interpreter reaches its final state should be called with the last received event', () => {
      let receivedEvent;
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              NEXT: 'b'
            }
          },
          b: {
            type: 'final'
          }
        },
        exit: (_ctx, ev) => {
          receivedEvent = ev;
        }
      });

      const service = interpret(machine).start();
      service.send({ type: 'NEXT' });

      expect(receivedEvent).toEqual({ type: 'NEXT' });
    });

    // https://github.com/statelyai/xstate/issues/2880
    it('stopping an interpreter that receives events from its children exit handlers should not throw', () => {
      const child = createMachine({
        id: 'child',
        initial: 'idle',
        states: {
          idle: {
            exit: sendParent('EXIT')
          }
        }
      });

      const parent = createMachine({
        id: 'parent',
        invoke: child
      });

      const interpreter = interpret(parent);
      interpreter.start();

      expect(() => interpreter.stop()).not.toThrow();
    });

    it('sent events from exit handlers of a stopped child should not be received by the parent', () => {
      const child = createMachine({
        id: 'child',
        initial: 'idle',
        states: {
          idle: {
            exit: sendParent('EXIT')
          }
        }
      });

      const parent = createMachine({
        id: 'parent',
        context: () => ({
          child: spawn(child)
        }),
        on: {
          STOP_CHILD: {
            actions: stop((ctx: any) => ctx.child)
          },
          EXIT: {
            actions: () => {
              throw new Error('This should not be called.');
            }
          }
        }
      });

      const interpreter = interpret(parent).start();
      interpreter.send({ type: 'STOP_CHILD' });
    });

    it('sent events from exit handlers of a done child should be received by the parent ', () => {
      let eventReceived = false;

      const child = createMachine({
        id: 'child',
        initial: 'active',
        states: {
          active: {
            on: {
              FINISH: 'done'
            }
          },
          done: {
            type: 'final'
          }
        },
        exit: sendParent('CHILD_DONE')
      });

      const parent = createMachine({
        id: 'parent',
        context: () => ({
          child: spawn(child)
        }),
        on: {
          FINISH_CHILD: {
            actions: send({ type: 'FINISH' }, { to: (ctx: any) => ctx.child })
          },
          CHILD_DONE: {
            actions: () => {
              eventReceived = true;
            }
          }
        }
      });

      const interpreter = interpret(parent).start();
      interpreter.send({ type: 'FINISH_CHILD' });

      expect(eventReceived).toBe(true);
    });

    it('sent events from exit handlers of a stopped child should be received by its children ', () => {
      let eventReceived = false;

      const grandchild = createMachine({
        id: 'grandchild',
        on: {
          STOPPED: {
            actions: () => {
              eventReceived = true;
            }
          }
        }
      });

      const child = createMachine({
        id: 'child',
        invoke: {
          id: 'myChild',
          src: grandchild
        },
        exit: send({ type: 'STOPPED' }, { to: 'myChild' })
      });

      const parent = createMachine({
        id: 'parent',
        initial: 'a',
        states: {
          a: {
            invoke: {
              src: child
            },
            on: {
              NEXT: 'b'
            }
          },
          b: {}
        }
      });

      const interpreter = interpret(parent).start();
      interpreter.send({ type: 'NEXT' });

      expect(eventReceived).toBe(true);
    });

    it('sent events from exit handlers of a done child should be received by its children ', () => {
      let eventReceived = false;

      const grandchild = createMachine({
        id: 'grandchild',
        on: {
          STOPPED: {
            actions: () => {
              eventReceived = true;
            }
          }
        }
      });

      const child = createMachine({
        id: 'child',
        initial: 'a',
        invoke: {
          id: 'myChild',
          src: grandchild
        },
        states: {
          a: {
            on: {
              FINISH: 'b'
            }
          },
          b: {
            type: 'final'
          }
        },
        exit: send({ type: 'STOPPED' }, { to: 'myChild' })
      });

      const parent = createMachine({
        id: 'parent',
        invoke: {
          id: 'myChild',
          src: child
        },
        on: {
          NEXT: {
            actions: send({ type: 'FINISH' }, { to: 'myChild' })
          }
        }
      });

      const interpreter = interpret(parent).start();
      interpreter.send({ type: 'NEXT' });

      expect(eventReceived).toBe(true);
    });

    it('actors spawned in exit handlers of a stopped child should not be started', () => {
      const grandchild = createMachine({
        id: 'grandchild',
        entry: () => {
          throw new Error('This should not be called.');
        }
      });

      const parent = createMachine({
        id: 'parent',
        context: {},
        exit: assign({
          actorRef: () => spawn(grandchild)
        })
      });

      const interpreter = interpret(parent).start();
      interpreter.stop();
    });

    it('should execute referenced custom actions correctly when stopping an interpreter', () => {
      let called = false;
      const parent = createMachine(
        {
          id: 'parent',
          context: {},
          exit: 'referencedAction'
        },
        {
          actions: {
            referencedAction: () => {
              called = true;
            }
          }
        }
      );

      const interpreter = interpret(parent).start();
      interpreter.stop();

      expect(called).toBe(true);
    });

    it('should execute builtin actions correctly when stopping an interpreter', () => {
      const machine = createMachine(
        {
          context: {
            executedAssigns: [] as string[]
          },
          exit: [
            'referencedAction',
            assign({
              executedAssigns: (ctx: any) => [...ctx.executedAssigns, 'inline']
            })
          ]
        },
        {
          actions: {
            referencedAction: assign({
              executedAssigns: (ctx) => [...ctx.executedAssigns, 'referenced']
            })
          }
        }
      );

      const interpreter = interpret(machine).start();
      interpreter.stop();

      expect(interpreter.state.context.executedAssigns).toEqual([
        'referenced',
        'inline'
      ]);
    });

    it('should clear all scheduled events when the interpreter gets stopped', () => {
      const machine = createMachine({
        on: {
          INITIALIZE_SYNC_SEQUENCE: {
            actions: () => {
              // schedule those 2 events
              service.send({ type: 'SOME_EVENT' });
              service.send({ type: 'SOME_EVENT' });
              // but also immediately stop *while* the `INITIALIZE_SYNC_SEQUENCE` is still being processed
              service.stop();
            }
          },
          SOME_EVENT: {
            actions: () => {
              throw new Error('This should not be called.');
            }
          }
        }
      });

      const service = interpret(machine).start();

      service.send({ type: 'INITIALIZE_SYNC_SEQUENCE' });
    });

    it('should execute exit actions of the settled state of the last initiated microstep', () => {
      const exitActions: string[] = [];
      const machine = createMachine({
        initial: 'foo',
        states: {
          foo: {
            exit: () => {
              exitActions.push('foo action');
            },
            on: {
              INITIALIZE_SYNC_SEQUENCE: {
                target: 'bar',
                actions: [
                  () => {
                    // immediately stop *while* the `INITIALIZE_SYNC_SEQUENCE` is still being processed
                    service.stop();
                  },
                  () => {}
                ]
              }
            }
          },
          bar: {
            exit: () => {
              exitActions.push('bar action');
            }
          }
        }
      });

      const service = interpret(machine).start();

      service.send({ type: 'INITIALIZE_SYNC_SEQUENCE' });

      expect(exitActions).toEqual(['foo action', 'bar action']);
    });

    it('should execute exit actions of the settled state of the last initiated microstep after executing all actions from that microstep', () => {
      const executedActions: string[] = [];
      const machine = createMachine({
        initial: 'foo',
        states: {
          foo: {
            exit: () => {
              executedActions.push('foo exit action');
            },
            on: {
              INITIALIZE_SYNC_SEQUENCE: {
                target: 'bar',
                actions: [
                  () => {
                    // immediately stop *while* the `INITIALIZE_SYNC_SEQUENCE` is still being processed
                    service.stop();
                  },
                  () => {
                    executedActions.push('foo transition action');
                  }
                ]
              }
            }
          },
          bar: {
            exit: () => {
              executedActions.push('bar exit action');
            }
          }
        }
      });

      const service = interpret(machine).start();

      service.send({ type: 'INITIALIZE_SYNC_SEQUENCE' });

      expect(executedActions).toEqual([
        'foo exit action',
        'foo transition action',
        'bar exit action'
      ]);
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
    expect(stopMachine.transition(nextState, 'INVALID').actions).toHaveLength(
      0
    );
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

    expect(nextState.actions.map((a) => a.type)).toEqual(
      expect.arrayContaining(['definedAction', 'undefinedAction'])
    );

    expect(nextState.actions).toEqual([
      expect.objectContaining({ type: 'definedAction' }),
      expect.objectContaining({ type: 'definedAction' }),
      expect.objectContaining({ type: 'undefinedAction' })
    ]);
  });

  it('should reference actions defined in actions parameter of machine options (initial state)', () => {
    const { initialState } = simpleMachine;

    expect(initialState.actions.map((a) => a.type)).toEqual(
      expect.arrayContaining(['definedAction', 'undefinedAction'])
    );
  });

  it('should be able to reference action implementations from action objects', () => {
    const state = simpleMachine.transition('a', 'EVENT');

    expect(state.actions).toEqual([
      expect.objectContaining({ type: 'definedAction' })
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

    initialState.actions.forEach((action) => {
      if (action.exec) {
        action.exec(
          initialState.context,
          { type: 'any' },
          {
            action: action as any,
            state: initialState,
            _event: initialState._event
          }
        );
      }
    });

    expect(onEntryCalled).toBe(true);

    const inactiveState = anonMachine.transition(initialState, 'EVENT');

    expect(inactiveState.actions.length).toBe(2);

    inactiveState.actions.forEach((action) => {
      if (action.exec) {
        action.exec(
          inactiveState.context,
          { type: 'EVENT' },
          {
            action: action as any,
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
  it('should provide the original action and state to the exec function', (done) => {
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
  interface Ctx {
    items: Array<{ id: number }>;
  }
  type Events =
    | { type: 'SINGLE'; id: number }
    | { type: 'NONE'; id: number }
    | { type: 'EACH' }
    | { type: 'AS_STRINGS' };

  const dynamicMachine = Machine<Ctx, Events>({
    id: 'dynamic',
    initial: 'idle',
    context: {
      items: [{ id: 1 }, { id: 2 }, { id: 3 }]
    },
    states: {
      idle: {
        on: {
          SINGLE: {
            actions: pure((ctx, e) => {
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
            actions: pure((ctx, e) => {
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
            actions: pure((ctx) =>
              ctx.items.map((item: any, index: number) => ({
                type: 'EVENT',
                item,
                index
              }))
            )
          },
          AS_STRINGS: {
            actions: pure(() => ['SOME_ACTION'])
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
      {
        type: 'SINGLE_EVENT',
        length: 3,
        id: 3
      }
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
      {
        type: 'EVENT',
        item: { id: 1 },
        index: 0
      },
      {
        type: 'EVENT',
        item: { id: 2 },
        index: 1
      },
      {
        type: 'EVENT',
        item: { id: 3 },
        index: 2
      }
    ]);
  });

  it('should allow for purely defined action type strings', () => {
    const nextState = dynamicMachine.transition(
      dynamicMachine.initialState,
      'AS_STRINGS'
    );

    expect(nextState.actions).toEqual([{ type: 'SOME_ACTION' }]);
  });

  it('should allow function actions in pure', () => {
    let called = false;
    const machine = createMachine({
      entry: pure(() => [
        () => {
          called = true;
        }
      ])
    });

    interpret(machine).start();

    expect(called).toBeTruthy();
  });
});

describe('forwardTo()', () => {
  it('should forward an event to a service', (done) => {
    const child = Machine<void, { type: 'EVENT'; value: number }>({
      id: 'child',
      initial: 'active',
      states: {
        active: {
          on: {
            EVENT: {
              actions: sendParent('SUCCESS'),
              cond: (_, e) => e.value === 42
            }
          }
        }
      }
    });

    const parent = Machine({
      id: 'parent',
      initial: 'first',
      states: {
        first: {
          invoke: { src: child, id: 'myChild' },
          on: {
            EVENT: {
              actions: forwardTo('myChild')
            },
            SUCCESS: 'last'
          }
        },
        last: {
          type: 'final'
        }
      }
    });

    const service = interpret(parent)
      .onDone(() => done())
      .start();

    service.send('EVENT', { value: 42 });
  });

  it('should forward an event to a service (dynamic)', (done) => {
    const child = Machine<void, { type: 'EVENT'; value: number }>({
      id: 'child',
      initial: 'active',
      states: {
        active: {
          on: {
            EVENT: {
              actions: sendParent('SUCCESS'),
              cond: (_, e) => e.value === 42
            }
          }
        }
      }
    });

    const parent = Machine<{ child: any }>({
      id: 'parent',
      initial: 'first',
      context: {
        child: null
      },
      states: {
        first: {
          entry: assign({
            child: () => spawn(child)
          }),
          on: {
            EVENT: {
              actions: forwardTo((ctx) => ctx.child)
            },
            SUCCESS: 'last'
          }
        },
        last: {
          type: 'final'
        }
      }
    });

    const service = interpret(parent)
      .onDone(() => done())
      .start();

    service.send('EVENT', { value: 42 });
  });

  it('should not cause an infinite loop when forwarding to undefined', () => {
    const machine = createMachine({
      on: {
        '*': { cond: () => true, actions: forwardTo(undefined as any) }
      }
    });

    const service = interpret(machine).start();

    expect(() => service.send('TEST')).toThrowErrorMatchingInlineSnapshot(
      `"Attempted to forward event to undefined actor. This risks an infinite loop in the sender."`
    );
  });
});

describe('log()', () => {
  const logMachine = Machine<{ count: number }>({
    id: 'log',
    initial: 'string',
    context: {
      count: 42
    },
    states: {
      string: {
        entry: log('some string', 'string label'),
        on: {
          EXPR: {
            actions: log((ctx) => `expr ${ctx.count}`, 'expr label')
          }
        }
      }
    }
  });

  it('should log a string', () => {
    expect(logMachine.initialState.actions[0]).toMatchInlineSnapshot(`
      Object {
        "expr": "some string",
        "label": "string label",
        "type": "xstate.log",
        "value": "some string",
      }
    `);
  });

  it('should log an expression', () => {
    const nextState = logMachine.transition(logMachine.initialState, 'EXPR');
    expect(nextState.actions[0]).toMatchInlineSnapshot(`
      Object {
        "expr": [Function],
        "label": "expr label",
        "type": "xstate.log",
        "value": "expr 42",
      }
    `);
  });
});

describe('choose', () => {
  it('should execute a single conditional action', () => {
    interface Ctx {
      answer?: number;
    }

    const machine = createMachine<Ctx>({
      context: {},
      initial: 'foo',
      states: {
        foo: {
          entry: choose([
            { cond: () => true, actions: assign<Ctx>({ answer: 42 }) }
          ])
        }
      }
    });

    const service = interpret(machine).start();

    expect(service.state.context).toEqual({ answer: 42 });
  });

  it('should execute a multiple conditional actions', () => {
    let executed = false;

    interface Ctx {
      answer?: number;
    }

    const machine = createMachine<Ctx>({
      context: {},
      initial: 'foo',
      states: {
        foo: {
          entry: choose([
            {
              cond: () => true,
              actions: [() => (executed = true), assign<Ctx>({ answer: 42 })]
            }
          ])
        }
      }
    });

    const service = interpret(machine).start();

    expect(service.state.context).toEqual({ answer: 42 });
    expect(executed).toBeTruthy();
  });

  it('should only execute matched actions', () => {
    interface Ctx {
      answer?: number;
      shouldNotAppear?: boolean;
    }

    const machine = createMachine<Ctx>({
      context: {},
      initial: 'foo',
      states: {
        foo: {
          entry: choose([
            {
              cond: () => false,
              actions: assign<Ctx>({ shouldNotAppear: true })
            },
            { cond: () => true, actions: assign<Ctx>({ answer: 42 }) }
          ])
        }
      }
    });

    const service = interpret(machine).start();

    expect(service.state.context).toEqual({ answer: 42 });
  });

  it('should allow for fallback unguarded actions', () => {
    interface Ctx {
      answer?: number;
      shouldNotAppear?: boolean;
    }

    const machine = createMachine<Ctx>({
      context: {},
      initial: 'foo',
      states: {
        foo: {
          entry: choose([
            {
              cond: () => false,
              actions: assign<Ctx>({ shouldNotAppear: true })
            },
            { actions: assign<Ctx>({ answer: 42 }) }
          ])
        }
      }
    });

    const service = interpret(machine).start();

    expect(service.state.context).toEqual({ answer: 42 });
  });

  it('should allow for nested conditional actions', () => {
    interface Ctx {
      firstLevel: boolean;
      secondLevel: boolean;
      thirdLevel: boolean;
    }

    const machine = createMachine<Ctx>({
      context: {
        firstLevel: false,
        secondLevel: false,
        thirdLevel: false
      },
      initial: 'foo',
      states: {
        foo: {
          entry: choose([
            {
              cond: () => true,
              actions: [
                assign<Ctx>({ firstLevel: true }),
                choose([
                  {
                    cond: () => true,
                    actions: [
                      assign<Ctx>({ secondLevel: true }),
                      choose([
                        {
                          cond: () => true,
                          actions: [assign<Ctx>({ thirdLevel: true })]
                        }
                      ])
                    ]
                  }
                ])
              ]
            }
          ])
        }
      }
    });

    const service = interpret(machine).start();

    expect(service.state.context).toEqual({
      firstLevel: true,
      secondLevel: true,
      thirdLevel: true
    });
  });

  it('should provide context to a condition expression', () => {
    interface Ctx {
      counter: number;
      answer?: number;
    }
    const machine = createMachine<Ctx>({
      context: {
        counter: 101
      },
      initial: 'foo',
      states: {
        foo: {
          entry: choose([
            {
              cond: (ctx) => ctx.counter > 100,
              actions: assign<Ctx>({ answer: 42 })
            }
          ])
        }
      }
    });

    const service = interpret(machine).start();

    expect(service.state.context).toEqual({ counter: 101, answer: 42 });
  });

  it('should provide event to a condition expression', () => {
    interface Ctx {
      answer?: number;
    }
    interface Events {
      type: 'NEXT';
      counter: number;
    }

    const machine = createMachine<Ctx, Events>({
      context: {},
      initial: 'foo',
      states: {
        foo: {
          on: {
            NEXT: {
              target: 'bar',
              actions: choose<Ctx, Events>([
                {
                  cond: (_, event) => event.counter > 100,
                  actions: assign<Ctx, Events>({ answer: 42 })
                }
              ])
            }
          }
        },
        bar: {}
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'NEXT', counter: 101 });
    expect(service.state.context).toEqual({ answer: 42 });
  });

  it('should provide stateGuard.state to a condition expression', () => {
    type Ctx = { counter: number; answer?: number };
    const machine = createMachine<Ctx>({
      context: {
        counter: 101
      },
      type: 'parallel',
      states: {
        foo: {
          initial: 'waiting',
          states: {
            waiting: {
              on: {
                GIVE_ANSWER: 'answering'
              }
            },
            answering: {
              entry: choose([
                {
                  cond: (_, __, { state }) => state.matches('bar'),
                  actions: assign<Ctx>({ answer: 42 })
                }
              ])
            }
          }
        },
        bar: {}
      }
    });

    const service = interpret(machine).start();
    service.send('GIVE_ANSWER');

    expect(service.state.context).toEqual({ counter: 101, answer: 42 });
  });

  it('should be able to use actions and guards defined in options', () => {
    interface Ctx {
      answer?: number;
    }

    const machine = createMachine<Ctx>(
      {
        context: {},
        initial: 'foo',
        states: {
          foo: {
            entry: choose([{ cond: 'worstGuard', actions: 'revealAnswer' }])
          }
        }
      },
      {
        guards: {
          worstGuard: () => true
        },
        actions: {
          revealAnswer: assign<Ctx>({ answer: 42 })
        }
      }
    );

    const service = interpret(machine).start();

    expect(service.state.context).toEqual({ answer: 42 });
  });

  it('should be able to use choose actions from within options', () => {
    interface Ctx {
      answer?: number;
    }

    const machine = createMachine<Ctx>(
      {
        context: {},
        initial: 'foo',
        states: {
          foo: {
            entry: 'conditionallyRevealAnswer'
          }
        }
      },
      {
        guards: {
          worstGuard: () => true
        },
        actions: {
          revealAnswer: assign<Ctx>({ answer: 42 }),
          conditionallyRevealAnswer: choose([
            { cond: 'worstGuard', actions: 'revealAnswer' }
          ])
        }
      }
    );

    const service = interpret(machine).start();

    expect(service.state.context).toEqual({ answer: 42 });
  });
});

describe('sendParent', () => {
  // https://github.com/statelyai/xstate/issues/711
  it('TS: should compile for any event', () => {
    interface ChildContext {}
    interface ChildEvent {
      type: 'CHILD';
    }

    const child = Machine<ChildContext, any, ChildEvent>({
      id: 'child',
      initial: 'start',
      states: {
        start: {
          // This should not be a TypeScript error
          entry: [sendParent({ type: 'PARENT' })]
        }
      }
    });

    expect(child).toBeTruthy();
  });
});

describe('sendTo', () => {
  it('should be able to send an event to an actor', (done) => {
    const childMachine = createMachine<any, { type: 'EVENT' }>({
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            EVENT: {
              actions: () => done()
            }
          }
        }
      }
    });

    const parentMachine = createMachine<{
      child: ActorRefFrom<typeof childMachine>;
    }>({
      context: () => ({
        child: spawn(childMachine)
      }),
      entry: sendTo((ctx) => ctx.child, { type: 'EVENT' })
    });

    interpret(parentMachine).start();
  });

  it('should be able to send an event from expression to an actor', (done) => {
    const childMachine = createMachine<any, { type: 'EVENT'; count: number }>({
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            EVENT: {
              cond: (_, e) => e.count === 42,
              actions: () => done()
            }
          }
        }
      }
    });

    const parentMachine = createMachine<{
      child: ActorRefFrom<typeof childMachine>;
      count: number;
    }>({
      context: () => ({
        child: spawn(childMachine),
        count: 42
      }),
      entry: sendTo(
        (ctx) => ctx.child,
        (ctx) => ({ type: 'EVENT', count: ctx.count })
      )
    });

    interpret(parentMachine).start();
  });

  it('should report a type error for an invalid event', () => {
    const childMachine = createMachine<any, { type: 'EVENT' }>({
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            EVENT: {}
          }
        }
      }
    });

    createMachine<{
      child: ActorRefFrom<typeof childMachine>;
    }>({
      context: () => ({
        child: spawn(childMachine)
      }),
      entry: sendTo((ctx) => ctx.child, {
        // @ts-expect-error
        type: 'UNKNOWN'
      })
    });
  });

  it('should be able to send an event to a named actor', (done) => {
    const childMachine = createMachine<any, { type: 'EVENT' }>({
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            EVENT: {
              actions: () => done()
            }
          }
        }
      }
    });

    const parentMachine = createMachine<{
      child: ActorRefFrom<typeof childMachine>;
    }>({
      context: () => ({
        child: spawn(childMachine, 'child')
      }),
      // No type-safety for the event yet
      entry: sendTo('child', { type: 'EVENT' })
    });

    interpret(parentMachine).start();
  });

  it('should be able to send an event directly to an ActorRef', (done) => {
    const childMachine = createMachine<any, { type: 'EVENT' }>({
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            EVENT: {
              actions: () => done()
            }
          }
        }
      }
    });

    const parentMachine = createMachine<{
      child: ActorRefFrom<typeof childMachine>;
    }>({
      context: () => ({
        child: spawn(childMachine)
      }),
      entry: pure<
        {
          child: ActorRefFrom<typeof childMachine>;
        },
        any
      >((ctx) => {
        return [sendTo(ctx.child, { type: 'EVENT' })];
      })
    });

    interpret(parentMachine).start();
  });

  it('should be able to read from event', () => {
    expect.assertions(1);
    const machine = createMachine<any, any>({
      initial: 'a',
      context: () => ({
        foo: spawn((_, receive) => {
          receive((event) => {
            expect(event).toEqual({ type: 'EVENT' });
          });
        })
      }),
      states: {
        a: {
          on: {
            EVENT: {
              actions: sendTo((ctx, e) => ctx[e.value], { type: 'EVENT' })
            }
          }
        }
      }
    });

    const service = interpret(machine).start();

    service.send({ type: 'EVENT', value: 'foo' });
  });
});

describe('raise', () => {
  it('should be able to send a delayed event to itself', (done) => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          entry: raise(
            { type: 'EVENT' },
            {
              delay: 1
            }
          ),
          on: {
            TO_B: 'b'
          }
        },
        b: {
          on: {
            EVENT: 'c'
          }
        },
        c: {
          type: 'final'
        }
      }
    });

    const service = interpret(machine).start();

    service.onDone(() => done());

    // Ensures that the delayed self-event is sent when in the `b` state
    service.send({ type: 'TO_B' });
  });

  it('should be able to send a delayed event to itself with delay = 0', (done) => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          entry: raise(
            { type: 'EVENT' },
            {
              delay: 0
            }
          ),
          on: {
            EVENT: 'b'
          }
        },
        b: {}
      }
    });

    const service = interpret(machine).start();

    // The state should not be changed yet; equivalent to
    // setTimeout(..., 0)
    expect(service.getSnapshot().value).toEqual('a');

    setTimeout(() => {
      // The state should be changed now
      expect(service.getSnapshot().value).toEqual('b');
      done();
    });
  });

  it('should be able to raise an event and respond to it in the same state', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          entry: raise({ type: 'TO_B' }),
          on: {
            TO_B: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const service = interpret(machine).start();

    expect(service.getSnapshot().value).toEqual('b');
  });

  it('should be able to raise a delayed event and respond to it in the same state', (done) => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          entry: raise(
            { type: 'TO_B' },
            {
              delay: 100
            }
          ),
          on: {
            TO_B: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const service = interpret(machine).start();

    service.onDone(() => done());

    setTimeout(() => {
      // didn't transition yet
      expect(service.getSnapshot().value).toEqual('a');
    }, 50);
  });

  it('should accept event expression', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: {
              actions: raise(() => ({ type: 'RAISED' }))
            },
            RAISED: 'b'
          }
        },
        b: {}
      }
    });

    const actor = interpret(machine).start();

    actor.send({ type: 'NEXT' });

    expect(actor.getSnapshot().value).toBe('b');
  });

  it('should be possible to access context in the event expression', () => {
    type MachineEvent =
      | {
          type: 'RAISED';
        }
      | {
          type: 'NEXT';
        };
    interface MachineContext {
      eventType: MachineEvent['type'];
    }
    const machine = createMachine<MachineContext, MachineEvent>({
      initial: 'a',
      context: {
        eventType: 'RAISED'
      },
      states: {
        a: {
          on: {
            NEXT: {
              actions: raise<MachineContext, any>((ctx: any) => ({
                type: ctx.eventType
              }))
            },
            RAISED: 'b'
          }
        },
        b: {}
      }
    });

    const actor = interpret(machine).start();

    actor.send({ type: 'NEXT' });

    expect(actor.getSnapshot().value).toBe('b');
  });

  it('should be possible to cancel a raised delayed event', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: {
              actions: raise({ type: 'RAISED' }, { delay: 1, id: 'myId' })
            },
            RAISED: 'b',
            CANCEL: {
              actions: actions.cancel('myId')
            }
          }
        },
        b: {}
      }
    });

    const actor = interpret(machine).start();

    actor.send({ type: 'CANCEL' });

    setTimeout(() => {
      expect(actor.getSnapshot().value).toBe('a');
    }, 10);
  });
});

it('should call transition actions in document order for same-level parallel regions', () => {
  const actual: string[] = [];

  const machine = createMachine({
    type: 'parallel',
    states: {
      a: {
        on: {
          FOO: {
            actions: () => actual.push('a')
          }
        }
      },
      b: {
        on: {
          FOO: {
            actions: () => actual.push('b')
          }
        }
      }
    }
  });
  const service = interpret(machine).start();
  service.send({ type: 'FOO' });

  expect(actual).toEqual(['a', 'b']);
});

it('should call transition actions in document order for states at different levels of parallel regions', () => {
  const actual: string[] = [];

  const machine = createMachine({
    type: 'parallel',
    states: {
      a: {
        initial: 'a1',
        states: {
          a1: {
            on: {
              FOO: {
                actions: () => actual.push('a1')
              }
            }
          }
        }
      },
      b: {
        on: {
          FOO: {
            actions: () => actual.push('b')
          }
        }
      }
    }
  });
  const service = interpret(machine).start();
  service.send({ type: 'FOO' });

  expect(actual).toEqual(['a1', 'b']);
});

describe('assign action order', () => {
  it('should preserve action order when .preserveActionOrder = true', () => {
    const captured: number[] = [];

    const machine = createMachine<{ count: number }>({
      context: { count: 0 },
      entry: [
        (ctx) => captured.push(ctx.count), // 0
        assign({ count: (ctx) => ctx.count + 1 }),
        (ctx) => captured.push(ctx.count), // 1
        assign({ count: (ctx) => ctx.count + 1 }),
        (ctx) => captured.push(ctx.count) // 2
      ],
      preserveActionOrder: true
    });

    interpret(machine).start();

    expect(captured).toEqual([0, 1, 2]);
  });

  it('should deeply preserve action order when .preserveActionOrder = true', () => {
    const captured: number[] = [];

    interface CountCtx {
      count: number;
    }

    const machine = createMachine<CountCtx>({
      context: { count: 0 },
      entry: [
        (ctx) => captured.push(ctx.count), // 0
        pure(() => {
          return [
            assign<CountCtx>({ count: (ctx) => ctx.count + 1 }),
            { type: 'capture', exec: (ctx: any) => captured.push(ctx.count) }, // 1
            assign<CountCtx>({ count: (ctx) => ctx.count + 1 })
          ];
        }),
        (ctx) => captured.push(ctx.count) // 2
      ],
      preserveActionOrder: true
    });

    interpret(machine).start();

    expect(captured).toEqual([0, 1, 2]);
  });

  it('should capture correct context values on subsequent transitions', () => {
    let captured: number[] = [];

    const machine = createMachine<{ counter: number }>({
      context: {
        counter: 0
      },
      on: {
        EV: {
          actions: [
            assign({ counter: (ctx) => ctx.counter + 1 }),
            (ctx) => captured.push(ctx.counter)
          ]
        }
      },
      preserveActionOrder: true
    });

    const service = interpret(machine).start();

    service.send('EV');
    service.send('EV');

    expect(captured).toEqual([1, 2]);
  });

  it.each([undefined, false])(
    'should prioritize assign actions when .preserveActionOrder = %i',
    (preserveActionOrder) => {
      const captured: number[] = [];

      const machine = createMachine<{ count: number }>({
        context: { count: 0 },
        entry: [
          (ctx) => captured.push(ctx.count),
          assign({ count: (ctx) => ctx.count + 1 }),
          (ctx) => captured.push(ctx.count),
          assign({ count: (ctx) => ctx.count + 1 }),
          (ctx) => captured.push(ctx.count)
        ],
        preserveActionOrder
      });

      interpret(machine).start();

      expect(captured).toEqual([2, 2, 2]);
    }
  );
});
