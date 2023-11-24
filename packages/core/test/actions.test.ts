import { ActorRef, EventObject } from '../src/index.ts';
import {
  cancel,
  choose,
  log,
  pure,
  raise,
  sendParent,
  sendTo,
  stop
} from '../src/actions.ts';
import {
  ActorRefFrom,
  assign,
  createMachine,
  forwardTo,
  createActor
} from '../src/index.ts';
import { CallbackActorRef, fromCallback } from '../src/actors/callback.ts';
import { trackEntries } from './utils.ts';

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

describe('entry/exit actions', () => {
  describe('State.actions', () => {
    it('should return the entry actions of an initial state', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {}
        }
      });
      const flushTracked = trackEntries(machine);
      createActor(machine).start();

      expect(flushTracked()).toEqual(['enter: __root__', 'enter: green']);
    });

    it('should return the entry actions of an initial state (deep)', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'a1',
            states: {
              a1: {
                on: {
                  NEXT: 'a2'
                }
              },
              a2: {}
            },
            on: { CHANGE: 'b' }
          },
          b: {}
        }
      });

      const flushTracked = trackEntries(machine);
      createActor(machine).start();

      expect(flushTracked()).toEqual([
        'enter: __root__',
        'enter: a',
        'enter: a.a1'
      ]);
    });

    it('should return the entry actions of an initial state (parallel)', () => {
      const machine = createMachine({
        type: 'parallel',
        states: {
          a: {
            initial: 'a1',
            states: {
              a1: {}
            }
          },
          b: {
            initial: 'b1',
            states: {
              b1: {}
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);
      createActor(machine).start();

      expect(flushTracked()).toEqual([
        'enter: __root__',
        'enter: a',
        'enter: a.a1',
        'enter: b',
        'enter: b.b1'
      ]);
    });

    it('should return the entry and exit actions of a transition', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {
            on: {
              TIMER: 'yellow'
            }
          },
          yellow: {}
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({ type: 'TIMER' });

      expect(flushTracked()).toEqual(['exit: green', 'enter: yellow']);
    });

    it('should return the entry and exit actions of a deep transition', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {
            on: {
              TIMER: 'yellow'
            }
          },
          yellow: {
            initial: 'speed_up',
            states: {
              speed_up: {}
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({ type: 'TIMER' });

      expect(flushTracked()).toEqual([
        'exit: green',
        'enter: yellow',
        'enter: yellow.speed_up'
      ]);
    });

    it('should return the entry and exit actions of a nested transition', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {
            initial: 'walk',
            states: {
              walk: {
                on: {
                  PED_COUNTDOWN: 'wait'
                }
              },
              wait: {}
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({ type: 'PED_COUNTDOWN' });

      expect(flushTracked()).toEqual(['exit: green.walk', 'enter: green.wait']);
    });

    it('should not have actions for unhandled events (shallow)', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {}
        }
      });
      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({ type: 'FAKE' });

      expect(flushTracked()).toEqual([]);
    });

    it('should not have actions for unhandled events (deep)', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {
            initial: 'walk',
            states: {
              walk: {},
              wait: {},
              stop: {}
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({ type: 'FAKE' });

      expect(flushTracked()).toEqual([]);
    });

    it('should exit and enter the state for reentering self-transitions (shallow)', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {
            on: {
              RESTART: {
                target: 'green',
                reenter: true
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({ type: 'RESTART' });

      expect(flushTracked()).toEqual(['exit: green', 'enter: green']);
    });

    it('should exit and enter the state for reentering self-transitions (deep)', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {
            on: {
              RESTART: {
                target: 'green',
                reenter: true
              }
            },
            initial: 'walk',
            states: {
              walk: {},
              wait: {},
              stop: {}
            }
          }
        }
      });
      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();

      flushTracked();
      actor.send({ type: 'RESTART' });

      expect(flushTracked()).toEqual([
        'exit: green.walk',
        'exit: green',
        'enter: green',
        'enter: green.walk'
      ]);
    });

    it('should return actions for parallel machines', () => {
      const actual: string[] = [];
      const machine = createMachine({
        type: 'parallel',
        states: {
          a: {
            initial: 'a1',
            states: {
              a1: {
                on: {
                  CHANGE: {
                    target: 'a2',
                    actions: [
                      () => actual.push('do_a2'),
                      () => actual.push('another_do_a2')
                    ]
                  }
                },
                entry: () => actual.push('enter_a1'),
                exit: () => actual.push('exit_a1')
              },
              a2: {
                entry: () => actual.push('enter_a2'),
                exit: () => actual.push('exit_a2')
              }
            },
            entry: () => actual.push('enter_a'),
            exit: () => actual.push('exit_a')
          },
          b: {
            initial: 'b1',
            states: {
              b1: {
                on: {
                  CHANGE: { target: 'b2', actions: () => actual.push('do_b2') }
                },
                entry: () => actual.push('enter_b1'),
                exit: () => actual.push('exit_b1')
              },
              b2: {
                entry: () => actual.push('enter_b2'),
                exit: () => actual.push('exit_b2')
              }
            },
            entry: () => actual.push('enter_b'),
            exit: () => actual.push('exit_b')
          }
        }
      });

      const actor = createActor(machine).start();
      actual.length = 0;

      actor.send({ type: 'CHANGE' });

      expect(actual).toEqual([
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
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'a1',
            states: {
              a1: {}
            },
            on: { CHANGE: 'b' }
          },
          b: {
            initial: 'b1',
            states: {
              b1: {}
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();

      flushTracked();
      actor.send({ type: 'CHANGE' });

      expect(flushTracked()).toEqual([
        'exit: a.a1',
        'exit: a',
        'enter: b',
        'enter: b.b1'
      ]);
    });

    it('should ignore parent state actions for same-parent substates', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'a1',
            states: {
              a1: {
                on: {
                  NEXT: 'a2'
                }
              },
              a2: {}
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();

      flushTracked();
      actor.send({ type: 'NEXT' });

      expect(flushTracked()).toEqual(['exit: a.a1', 'enter: a.a2']);
    });

    it('should work with function actions', () => {
      const entrySpy = jest.fn();
      const exitSpy = jest.fn();
      const transitionSpy = jest.fn();

      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'a1',
            states: {
              a1: {
                on: {
                  NEXT_FN: 'a3'
                }
              },
              a2: {},
              a3: {
                on: {
                  NEXT: {
                    target: 'a2',
                    actions: [transitionSpy]
                  }
                },
                entry: entrySpy,
                exit: exitSpy
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({ type: 'NEXT_FN' });

      expect(flushTracked()).toEqual(['exit: a.a1', 'enter: a.a3']);
      expect(entrySpy).toHaveBeenCalled();

      actor.send({ type: 'NEXT' });

      expect(flushTracked()).toEqual(['exit: a.a3', 'enter: a.a2']);
      expect(exitSpy).toHaveBeenCalled();
      expect(transitionSpy).toHaveBeenCalled();
    });

    it('should exit children of parallel state nodes', () => {
      const machine = createMachine({
        initial: 'B',
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
                  C1: {}
                }
              },
              D: {
                initial: 'D1',
                states: {
                  D1: {}
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();

      flushTracked();
      actor.send({ type: 'to-A' });

      expect(flushTracked()).toEqual([
        'exit: B.D.D1',
        'exit: B.D',
        'exit: B.C.C1',
        'exit: B.C',
        'exit: B',
        'enter: A'
      ]);
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

      const actor = createActor(machine).start();

      flushTracked();
      actor.send({ type: 'UPDATE' });

      expect(flushTracked()).toEqual([
        'exit: loaded.idle',
        'exit: loaded',
        'enter: loaded',
        'enter: loaded.idle'
      ]);
    });

    it("shouldn't use a referenced custom action over a builtin one when there is a naming conflict", () => {
      const spy = jest.fn();
      const machine = createMachine(
        {
          context: {
            assigned: false
          },
          on: {
            EV: {
              actions: assign({ assigned: true })
            }
          }
        },
        {
          actions: {
            'xstate.assign': spy
          }
        }
      );

      const actor = createActor(machine).start();
      actor.send({ type: 'EV' });

      expect(spy).not.toHaveBeenCalled();
      expect(actor.getSnapshot().context.assigned).toBe(true);
    });

    it("shouldn't use a referenced custom action over an inline one when there is a naming conflict", () => {
      const spy = jest.fn();
      let called = false;

      const machine = createMachine(
        {
          on: {
            EV: {
              // it's important for this test to use a named function
              actions: function myFn() {
                called = true;
              }
            }
          }
        },
        {
          actions: {
            myFn: spy
          }
        }
      );

      const actor = createActor(machine).start();
      actor.send({ type: 'EV' });

      expect(spy).not.toHaveBeenCalled();
      expect(called).toBe(true);
    });

    it('root entry/exit actions should be called on root reentering transitions', () => {
      let entrySpy = jest.fn();
      let exitSpy = jest.fn();

      const machine = createMachine({
        id: 'root',
        entry: entrySpy,
        exit: exitSpy,
        on: {
          EVENT: {
            target: '#two',
            reenter: true
          }
        },
        initial: 'one',
        states: {
          one: {},
          two: {
            id: 'two'
          }
        }
      });

      const service = createActor(machine).start();

      entrySpy.mockClear();
      exitSpy.mockClear();

      service.send({ type: 'EVENT' });

      expect(entrySpy).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalled();
    });

    describe('should ignore same-parent state actions (sparse)', () => {
      it('with a relative transition', () => {
        const machine = createMachine({
          initial: 'ping',
          states: {
            ping: {
              initial: 'foo',
              states: {
                foo: {
                  on: {
                    TACK: 'bar'
                  }
                },
                bar: {}
              }
            }
          }
        });

        const flushTracked = trackEntries(machine);

        const actor = createActor(machine).start();
        flushTracked();

        actor.send({ type: 'TACK' });

        expect(flushTracked()).toEqual(['exit: ping.foo', 'enter: ping.bar']);
      });

      it('with an absolute transition', () => {
        const machine = createMachine({
          id: 'root',
          initial: 'ping',
          states: {
            ping: {
              initial: 'foo',
              states: {
                foo: {
                  on: {
                    ABSOLUTE_TACK: '#root.ping.bar'
                  }
                },
                bar: {}
              }
            },
            pong: {}
          }
        });

        const flushTracked = trackEntries(machine);

        const actor = createActor(machine).start();
        flushTracked();

        actor.send({ type: 'ABSOLUTE_TACK' });

        expect(flushTracked()).toEqual(['exit: ping.foo', 'enter: ping.bar']);
      });
    });
  });

  describe('entry/exit actions', () => {
    it('should return the entry actions of an initial state', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {}
        }
      });
      const flushTracked = trackEntries(machine);
      createActor(machine).start();

      expect(flushTracked()).toEqual(['enter: __root__', 'enter: green']);
    });

    it('should return the entry and exit actions of a transition', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {
            on: {
              TIMER: 'yellow'
            }
          },
          yellow: {}
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({ type: 'TIMER' });

      expect(flushTracked()).toEqual(['exit: green', 'enter: yellow']);
    });

    it('should return the entry and exit actions of a deep transition', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {
            on: {
              TIMER: 'yellow'
            }
          },
          yellow: {
            initial: 'speed_up',
            states: {
              speed_up: {}
            }
          }
        }
      });
      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({ type: 'TIMER' });

      expect(flushTracked()).toEqual([
        'exit: green',
        'enter: yellow',
        'enter: yellow.speed_up'
      ]);
    });

    it('should return the entry and exit actions of a nested transition', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {
            initial: 'walk',
            states: {
              walk: {
                on: {
                  PED_COUNTDOWN: 'wait'
                }
              },
              wait: {}
            }
          }
        }
      });
      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({ type: 'PED_COUNTDOWN' });

      expect(flushTracked()).toEqual(['exit: green.walk', 'enter: green.wait']);
    });

    it('should keep the same state for unhandled events (shallow)', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {}
        }
      });
      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({ type: 'FAKE' });

      expect(flushTracked()).toEqual([]);
    });

    it('should keep the same state for unhandled events (deep)', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {
            initial: 'walk',
            states: {
              walk: {}
            }
          }
        }
      });
      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({ type: 'FAKE' });

      expect(flushTracked()).toEqual([]);
    });

    it('should exit and enter the state for reentering self-transitions (shallow)', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {
            on: {
              RESTART: {
                target: 'green',
                reenter: true
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({ type: 'RESTART' });

      expect(flushTracked()).toEqual(['exit: green', 'enter: green']);
    });

    it('should exit and enter the state for reentering self-transitions (deep)', () => {
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {
            on: {
              RESTART: {
                target: 'green',
                reenter: true
              }
            },
            initial: 'walk',
            states: {
              walk: {}
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({ type: 'RESTART' });
      expect(flushTracked()).toEqual([
        'exit: green.walk',
        'exit: green',
        'enter: green',
        'enter: green.walk'
      ]);
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

      const service = createActor(machine).start();
      flushTracked();
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

      const service = createActor(machine).start();
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

    it('should enter all descendents when target is a descendent of the source when using an reentering transition', () => {
      const machine = createMachine({
        initial: 'A',
        states: {
          A: {
            initial: 'A1',
            on: {
              NEXT: {
                reenter: true,
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

      const service = createActor(machine).start();
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

    it('should exit deep descendant during a default self-transition', () => {
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

      const service = createActor(m).start();

      flushTracked();
      service.send({ type: 'EV' });

      expect(flushTracked()).toEqual([
        'exit: a.a1.a11',
        'exit: a.a1',
        'enter: a.a1',
        'enter: a.a1.a11'
      ]);
    });

    it('should exit deep descendant during a reentering self-transition', () => {
      const m = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EV: {
                target: 'a',
                reenter: true
              }
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

      const service = createActor(m).start();

      flushTracked();
      service.send({ type: 'EV' });

      expect(flushTracked()).toEqual([
        'exit: a.a1.a11',
        'exit: a.a1',
        'exit: a',
        'enter: a',
        'enter: a.a1',
        'enter: a.a1.a11'
      ]);
    });

    it('should not reenter leaf state during its default self-transition', () => {
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

      const service = createActor(m).start();

      flushTracked();
      service.send({ type: 'EV' });

      expect(flushTracked()).toEqual([]);
    });

    it('should reenter leaf state during its reentering self-transition', () => {
      const m = createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'a1',
            states: {
              a1: {
                on: {
                  EV: {
                    target: 'a1',
                    reenter: true
                  }
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(m);

      const service = createActor(m).start();

      flushTracked();
      service.send({ type: 'EV' });

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

      const service = createActor(m).start();
      service.send({ type: 'EV' });

      flushTracked();
      service.send({ type: 'EV' });

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

      const service = createActor(m).start();
      service.send({ type: 'EV' });

      flushTracked();
      service.send({ type: 'EV' });

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
      const machine = createMachine({
        initial: 'start',
        states: {
          start: {
            on: { ENTER_PARALLEL: 'p1' }
          },
          p1: {
            type: 'parallel',
            states: {
              nested: {
                initial: 'inner',
                states: {
                  inner: {}
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();

      flushTracked();
      actor.send({ type: 'ENTER_PARALLEL' });

      expect(flushTracked()).toEqual([
        'exit: start',
        'enter: p1',
        'enter: p1.nested',
        'enter: p1.nested.inner'
      ]);
    });

    it('should reenter parallel region when a parallel state gets reentered while targeting another region', () => {
      const machine = createMachine({
        initial: 'ready',
        states: {
          ready: {
            type: 'parallel',
            on: {
              FOO: {
                target: '#cameraOff',
                reenter: true
              }
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

      const service = createActor(machine).start();

      flushTracked();
      service.send({ type: 'FOO' });

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

    it('should reenter parallel region when a parallel state is reentered while targeting another region', () => {
      const machine = createMachine({
        initial: 'ready',
        states: {
          ready: {
            type: 'parallel',
            on: {
              FOO: {
                target: '#cameraOff',
                reenter: true
              }
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

      const service = createActor(machine).start();

      flushTracked();
      service.send({ type: 'FOO' });

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
      const parent = createMachine({
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

      const service = createActor(parent).start();

      flushTracked();
      service.send({ type: 'WHATEVER' });

      expect(flushTracked()).toEqual([]);
    });

    it("shouldn't exit (and reenter) state on targetless delayed transition", (done) => {
      const machine = createMachine({
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

      createActor(machine).start();
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
      const childMachine = createMachine({
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

      const parentMachine = createMachine({
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

      const actor = createActor(parentMachine);
      actor.subscribe({
        complete: () => {
          expect(exitCalled).toBeTruthy();
          expect(childExitCalled).toBeTruthy();
          done();
        }
      });
      actor.start();
    });
  });

  describe('when stopped', () => {
    it('exit actions should not be called when stopping a machine', () => {
      const rootSpy = jest.fn();
      const childSpy = jest.fn();

      const machine = createMachine({
        exit: rootSpy,
        initial: 'a',
        states: {
          a: {
            exit: childSpy
          }
        }
      });

      const service = createActor(machine).start();
      service.stop();

      expect(rootSpy).not.toHaveBeenCalled();
      expect(childSpy).not.toHaveBeenCalled();
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
        exit: ({ event }) => {
          receivedEvent = event;
        }
      });

      const service = createActor(machine).start();
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
            exit: sendParent({ type: 'EXIT' })
          }
        }
      });

      const parent = createMachine({
        id: 'parent',
        invoke: {
          src: child
        }
      });

      const interpreter = createActor(parent);
      interpreter.start();

      expect(() => interpreter.stop()).not.toThrow();
    });

    // TODO: determine if the sendParent action should execute when the child actor is stopped.
    // If it shouldn't be, we need to clarify whether exit actions in general should be executed on machine stop,
    // since this is contradictory to other tests.
    it.skip('sent events from exit handlers of a stopped child should not be received by the parent', () => {
      const child = createMachine({
        id: 'child',
        initial: 'idle',
        states: {
          idle: {
            exit: sendParent({ type: 'EXIT' })
          }
        }
      });

      const parent = createMachine({
        types: {} as {
          context: {
            child: ActorRefFrom<typeof child>;
          };
        },
        id: 'parent',
        context: ({ spawn }) => ({
          child: spawn(child)
        }),
        on: {
          STOP_CHILD: {
            actions: stop(({ context }) => context.child)
          },
          EXIT: {
            actions: () => {
              throw new Error('This should not be called.');
            }
          }
        }
      });

      const interpreter = createActor(parent).start();
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
        exit: sendParent({ type: 'CHILD_DONE' })
      });

      const parent = createMachine({
        types: {} as {
          context: {
            child: ActorRefFrom<typeof child>;
          };
        },
        id: 'parent',
        context: ({ spawn }) => ({
          child: spawn(child)
        }),
        on: {
          FINISH_CHILD: {
            actions: sendTo(({ context }) => context.child, { type: 'FINISH' })
          },
          CHILD_DONE: {
            actions: () => {
              eventReceived = true;
            }
          }
        }
      });

      const interpreter = createActor(parent).start();
      interpreter.send({ type: 'FINISH_CHILD' });

      expect(eventReceived).toBe(true);
    });

    it('sent events from exit handlers of a stopped child should not be received by its children', () => {
      const spy = jest.fn();

      const grandchild = createMachine({
        id: 'grandchild',
        on: {
          STOPPED: {
            actions: spy
          }
        }
      });

      const child = createMachine({
        id: 'child',
        invoke: {
          id: 'myChild',
          src: grandchild
        },
        exit: sendTo('myChild', { type: 'STOPPED' })
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

      const interpreter = createActor(parent).start();
      interpreter.send({ type: 'NEXT' });

      expect(spy).not.toHaveBeenCalled();
    });

    it('sent events from exit handlers of a done child should be received by its children', () => {
      const spy = jest.fn();

      const grandchild = createMachine({
        id: 'grandchild',
        on: {
          STOPPED: {
            actions: spy
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
        exit: sendTo('myChild', { type: 'STOPPED' })
      });

      const parent = createMachine({
        id: 'parent',
        invoke: {
          id: 'myChild',
          src: child
        },
        on: {
          NEXT: {
            actions: sendTo('myChild', { type: 'FINISH' })
          }
        }
      });

      const interpreter = createActor(parent).start();
      interpreter.send({ type: 'NEXT' });

      expect(spy).toHaveBeenCalledTimes(1);
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
          actorRef: ({ spawn }) => spawn(grandchild)
        })
      });

      const interpreter = createActor(parent).start();
      interpreter.stop();
    });

    it('should note execute referenced custom actions correctly when stopping an interpreter', () => {
      const spy = jest.fn();
      const parent = createMachine(
        {
          id: 'parent',
          context: {},
          exit: 'referencedAction'
        },
        {
          actions: {
            referencedAction: spy
          }
        }
      );

      const interpreter = createActor(parent).start();
      interpreter.stop();

      expect(spy).not.toHaveBeenCalled();
    });

    it('should not execute builtin actions when stopping an interpreter', () => {
      const machine = createMachine(
        {
          context: {
            executedAssigns: [] as string[]
          },
          exit: [
            'referencedAction',
            assign({
              executedAssigns: ({ context }) => [
                ...context.executedAssigns,
                'inline'
              ]
            })
          ]
        },
        {
          actions: {
            referencedAction: assign({
              executedAssigns: ({ context }) => [
                ...context.executedAssigns,
                'referenced'
              ]
            })
          }
        }
      );

      const interpreter = createActor(machine).start();
      interpreter.stop();

      expect(interpreter.getSnapshot().context.executedAssigns).toEqual([]);
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

      const service = createActor(machine).start();

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

      const service = createActor(machine).start();

      service.send({ type: 'INITIALIZE_SYNC_SEQUENCE' });

      expect(exitActions).toEqual(['foo action']);
    });

    it('should not execute exit actions of the settled state of the last initiated microstep after executing all actions from that microstep', () => {
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

      const service = createActor(machine).start();

      service.send({ type: 'INITIALIZE_SYNC_SEQUENCE' });

      expect(executedActions).toEqual([
        'foo exit action',
        'foo transition action'
      ]);
    });
  });
});

describe('initial actions', () => {
  it('should support initial actions', () => {
    const actual: string[] = [];
    const machine = createMachine({
      initial: {
        target: 'a',
        actions: () => actual.push('initialA')
      },
      states: {
        a: {
          entry: () => actual.push('entryA')
        }
      }
    });
    createActor(machine).start();
    expect(actual).toEqual(['initialA', 'entryA']);
  });

  it('should support initial actions from transition', () => {
    const actual: string[] = [];
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          entry: () => actual.push('entryB'),
          initial: {
            target: 'foo',
            actions: () => actual.push('initialFoo')
          },
          states: {
            foo: {
              entry: () => actual.push('entryFoo')
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();

    actor.send({ type: 'NEXT' });

    expect(actual).toEqual(['entryB', 'initialFoo', 'entryFoo']);
  });

  it('should execute actions of initial transitions only once when taking an explicit transition', () => {
    const spy = jest.fn();
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          initial: {
            target: 'b_child',
            actions: () => spy('initial in b')
          },
          states: {
            b_child: {
              initial: {
                target: 'b_granchild',
                actions: () => spy('initial in b_child')
              },
              states: {
                b_granchild: {}
              }
            }
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({
      type: 'NEXT'
    });

    expect(spy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "initial in b",
        ],
        [
          "initial in b_child",
        ],
      ]
    `);
  });

  it('should execute actions of all initial transitions resolving to the initial state value', () => {
    const spy = jest.fn();
    const machine = createMachine({
      initial: {
        target: 'a',
        actions: () => spy('root')
      },
      states: {
        a: {
          initial: {
            target: 'a1',
            actions: () => spy('inner')
          },
          states: {
            a1: {}
          }
        }
      }
    });

    createActor(machine).start();

    expect(spy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "root",
        ],
        [
          "inner",
        ],
      ]
    `);
  });

  it('should execute actions of the initial transition when taking a root reentering self-transition', () => {
    const spy = jest.fn();
    const machine = createMachine({
      id: 'root',
      initial: {
        target: 'a',
        actions: spy
      },
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {}
      },
      on: {
        REENTER: {
          target: '#root',
          reenter: true
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'NEXT' });
    spy.mockClear();

    actorRef.send({ type: 'REENTER' });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(actorRef.getSnapshot().value).toEqual('a');
  });
});

describe('actions on invalid transition', () => {
  it('should not recall previous actions', () => {
    const spy = jest.fn();
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            STOP: {
              target: 'stop',
              actions: [spy]
            }
          }
        },
        stop: {}
      }
    });
    const actor = createActor(machine).start();

    actor.send({ type: 'STOP' });
    expect(spy).toHaveBeenCalledTimes(1);

    actor.send({ type: 'INVALID' });
    expect(spy).toHaveBeenCalledTimes(1);
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

  const definedAction = () => {};

  it('should reference actions defined in actions parameter of machine options (entry actions)', () => {
    const spy = jest.fn();
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: 'b'
          }
        },
        b: {
          entry: ['definedAction', { type: 'definedAction' }, 'undefinedAction']
        }
      },
      on: {
        E: '.a'
      }
    }).provide({
      actions: {
        definedAction: spy
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'EVENT' });

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should reference actions defined in actions parameter of machine options (initial state)', () => {
    const spy = jest.fn();
    const machine = createMachine(
      {
        entry: ['definedAction', { type: 'definedAction' }, 'undefinedAction']
      },
      {
        actions: {
          definedAction: spy
        }
      }
    );

    createActor(machine).start();

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should be able to reference action implementations from action objects', () => {
    const machine = createMachine(
      {
        types: {} as { context: Context; events: EventType },
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
        }
      },
      {
        actions: {
          definedAction,
          updateContext: assign({ count: 10 })
        }
      }
    );
    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT' });
    const snapshot = actorRef.getSnapshot();

    // expect(snapshot.actions).toEqual([
    //   expect.objectContaining({
    //     type: 'definedAction'
    //   }),
    //   expect.objectContaining({
    //     type: 'updateContext'
    //   })
    // ]);
    // TODO: specify which actions other actions came from

    expect(snapshot.context).toEqual({ count: 10 });
  });

  it('should work with anonymous functions (with warning)', () => {
    let entryCalled = false;
    let actionCalled = false;
    let exitCalled = false;

    const anonMachine = createMachine({
      id: 'anon',
      initial: 'active',
      states: {
        active: {
          entry: () => (entryCalled = true),
          exit: () => (exitCalled = true),
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

    const actor = createActor(anonMachine).start();

    expect(entryCalled).toBe(true);

    actor.send({ type: 'EVENT' });

    expect(exitCalled).toBe(true);
    expect(actionCalled).toBe(true);
  });
});

describe('action meta', () => {
  it('should provide the original params', () => {
    const spy = jest.fn();

    const testMachine = createMachine(
      {
        id: 'test',
        initial: 'foo',
        states: {
          foo: {
            entry: {
              type: 'entryAction',
              params: {
                value: 'something'
              }
            }
          }
        }
      },
      {
        actions: {
          entryAction: (_, params) => {
            spy(params);
          }
        }
      }
    );

    createActor(testMachine).start();

    expect(spy).toHaveBeenCalledWith({
      value: 'something'
    });
  });

  it('should provide undefined params when it was configured as string', () => {
    const spy = jest.fn();

    const testMachine = createMachine(
      {
        id: 'test',
        initial: 'foo',
        states: {
          foo: {
            entry: 'entryAction'
          }
        }
      },
      {
        actions: {
          entryAction: (_, params) => {
            spy(params);
          }
        }
      }
    );

    createActor(testMachine).start();

    expect(spy).toHaveBeenCalledWith(undefined);
  });

  it('should provide the action with resolved params when they are dynamic', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        entry: {
          type: 'entryAction',
          params: () => ({ stuff: 100 })
        }
      },
      {
        actions: {
          entryAction: (_, params) => {
            spy(params);
          }
        }
      }
    );

    createActor(machine).start();

    expect(spy).toHaveBeenCalledWith({
      stuff: 100
    });
  });

  it('should resolve dynamic params using context value', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        context: {
          secret: 42
        },
        entry: {
          type: 'entryAction',
          params: ({ context }) => ({ secret: context.secret })
        }
      },
      {
        actions: {
          entryAction: (_, params) => {
            spy(params);
          }
        }
      }
    );

    createActor(machine).start();

    expect(spy).toHaveBeenCalledWith({
      secret: 42
    });
  });

  it('should resolve dynamic params using event value', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        on: {
          FOO: {
            actions: {
              type: 'myAction',
              params: ({ event }) => ({ secret: event.secret })
            }
          }
        }
      },
      {
        actions: {
          myAction: (_, params) => {
            spy(params);
          }
        }
      }
    );

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'FOO', secret: 77 });

    expect(spy).toHaveBeenCalledWith({
      secret: 77
    });
  });
});

describe('purely defined actions', () => {
  it('should allow for a purely defined dynamic action', () => {
    const spy = jest.fn();
    const machine = createMachine(
      {
        context: {
          items: [{ id: 1 }, { id: 2 }, { id: 3 }]
        },
        entry: pure(({ context }) => {
          return {
            type: 'doSomething',
            params: { length: context.items.length }
          };
        })
      },
      {
        actions: {
          doSomething: (_, params) => spy(params)
        }
      }
    );

    createActor(machine).start();

    expect(spy.mock.calls[0][0]).toEqual({ length: 3 });
  });

  it('should allow for purely defined lack of actions', () => {
    const machine = createMachine({
      context: {
        items: [{ id: 1 }, { id: 2 }, { id: 3 }]
      },
      entry: pure(({ context }) => {
        if (context.items.length > 5) {
          return {
            type: 'doSomething',
            params: { length: context.items.length }
          };
        }
      })
    });

    expect(() => createActor(machine).start()).not.toThrow();
  });

  it('should allow for purely defined dynamic actions', () => {
    const spy = jest.fn();
    const machine = createMachine(
      {
        context: {
          items: [{ id: 1 }, { id: 2 }, { id: 3 }]
        },
        entry: pure(({ context }) =>
          context.items.map((item: any, index: number) => ({
            type: 'doSomething',
            params: { item, index }
          }))
        )
      },
      {
        actions: {
          doSomething: (_, params) => {
            spy(params);
          }
        }
      }
    );

    createActor(machine).start();

    expect(spy.mock.calls[0][0]).toEqual({ item: { id: 1 }, index: 0 });
    expect(spy.mock.calls[1][0]).toEqual({ item: { id: 2 }, index: 1 });
    expect(spy.mock.calls[2][0]).toEqual({ item: { id: 3 }, index: 2 });
  });

  it('should allow for purely defined action type strings', () => {
    const spy = jest.fn();
    const machine = createMachine(
      {
        entry: pure(() => ['SOME_ACTION'])
      },
      {
        actions: {
          SOME_ACTION: spy
        }
      }
    );

    createActor(machine).start();

    expect(spy).toBeCalled();
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

    createActor(machine).start();

    expect(called).toBeTruthy();
  });
});

describe('forwardTo()', () => {
  it('should forward an event to a service', (done) => {
    const child = createMachine({
      types: {} as {
        events: {
          type: 'EVENT';
          value: number;
        };
      },
      id: 'child',
      initial: 'active',
      states: {
        active: {
          on: {
            EVENT: {
              actions: sendParent({ type: 'SUCCESS' }),
              guard: ({ event }) => event.value === 42
            }
          }
        }
      }
    });

    const parent = createMachine({
      types: {} as {
        events:
          | {
              type: 'EVENT';
              value: number;
            }
          | {
              type: 'SUCCESS';
            };
      },
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

    const service = createActor(parent);
    service.subscribe({ complete: () => done() });
    service.start();

    service.send({ type: 'EVENT', value: 42 });
  });

  it('should forward an event to a service (dynamic)', (done) => {
    const child = createMachine({
      types: {} as {
        events: {
          type: 'EVENT';
          value: number;
        };
      },
      id: 'child',
      initial: 'active',
      states: {
        active: {
          on: {
            EVENT: {
              actions: sendParent({ type: 'SUCCESS' }),
              guard: ({ event }) => event.value === 42
            }
          }
        }
      }
    });

    const parent = createMachine({
      types: {} as {
        context: { child?: ActorRef<any, any> };
        events: { type: 'EVENT'; value: number } | { type: 'SUCCESS' };
      },
      id: 'parent',
      initial: 'first',
      context: {
        child: undefined
      },
      states: {
        first: {
          entry: assign({
            child: ({ spawn }) => spawn(child, { id: 'x' })
          }),
          on: {
            EVENT: {
              actions: forwardTo(({ context }) => context.child!)
            },
            SUCCESS: 'last'
          }
        },
        last: {
          type: 'final'
        }
      }
    });

    const service = createActor(parent);
    service.subscribe({ complete: () => done() });
    service.start();

    service.send({ type: 'EVENT', value: 42 });
  });

  it('should not cause an infinite loop when forwarding to undefined', () => {
    const machine = createMachine({
      on: {
        '*': { guard: () => true, actions: forwardTo(undefined as any) }
      }
    });

    const errorSpy = jest.fn();

    const actorRef = createActor(machine);
    actorRef.subscribe({
      error: errorSpy
    });
    actorRef.start();
    actorRef.send({ type: 'TEST' });

    expect(errorSpy).toMatchMockCallsInlineSnapshot(`
      [
        [
          [Error: Attempted to forward event to undefined actor. This risks an infinite loop in the sender.],
        ],
      ]
    `);
  });
});

describe('log()', () => {
  it('should log a string', () => {
    const consoleSpy = jest.fn();
    console.log = consoleSpy;
    const machine = createMachine({
      entry: log('some string', 'string label')
    });
    createActor(machine, { logger: consoleSpy }).start();

    expect(consoleSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "string label",
          "some string",
        ],
      ]
    `);
  });

  it('should log an expression', () => {
    const consoleSpy = jest.fn();
    console.log = consoleSpy;
    const machine = createMachine({
      context: {
        count: 42
      },
      entry: log(({ context }) => `expr ${context.count}`, 'expr label')
    });
    createActor(machine, { logger: consoleSpy }).start();

    expect(consoleSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "expr label",
          "expr 42",
        ],
      ]
    `);
  });
});

describe('choose', () => {
  it('should execute a single conditional action', () => {
    interface Ctx {
      answer?: number;
    }

    const machine = createMachine({
      types: {} as { context: Ctx },
      context: {},
      initial: 'foo',
      states: {
        foo: {
          entry: choose([
            { guard: () => true, actions: assign({ answer: 42 }) }
          ])
        }
      }
    });

    const service = createActor(machine).start();

    expect(service.getSnapshot().context).toEqual({ answer: 42 });
  });

  it('should execute a multiple conditional actions', () => {
    let executed = false;

    interface Ctx {
      answer?: number;
    }

    const machine = createMachine({
      types: {} as { context: Ctx },
      context: {},
      initial: 'foo',
      states: {
        foo: {
          entry: choose([
            {
              guard: () => true,
              actions: [() => (executed = true), assign({ answer: 42 })]
            }
          ])
        }
      }
    });

    const service = createActor(machine).start();

    expect(service.getSnapshot().context).toEqual({ answer: 42 });
    expect(executed).toBeTruthy();
  });

  it('should only execute matched actions', () => {
    interface Ctx {
      answer?: number;
      shouldNotAppear?: boolean;
    }

    const machine = createMachine({
      types: {} as { context: Ctx },
      context: {},
      initial: 'foo',
      states: {
        foo: {
          entry: choose([
            {
              guard: () => false,
              actions: assign({ shouldNotAppear: true })
            },
            { guard: () => true, actions: assign({ answer: 42 }) }
          ])
        }
      }
    });

    const service = createActor(machine).start();

    expect(service.getSnapshot().context).toEqual({ answer: 42 });
  });

  it('should allow for fallback unguarded actions', () => {
    interface Ctx {
      answer?: number;
      shouldNotAppear?: boolean;
    }

    const machine = createMachine({
      types: {} as { context: Ctx },
      context: {},
      initial: 'foo',
      states: {
        foo: {
          entry: choose([
            {
              guard: () => false,
              actions: assign({ shouldNotAppear: true })
            },
            { actions: assign({ answer: 42 }) }
          ])
        }
      }
    });

    const service = createActor(machine).start();

    expect(service.getSnapshot().context).toEqual({ answer: 42 });
  });

  it('should allow for nested conditional actions', () => {
    interface Ctx {
      firstLevel: boolean;
      secondLevel: boolean;
      thirdLevel: boolean;
    }

    const machine = createMachine({
      types: {} as { context: Ctx },
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
              guard: () => true,
              actions: [
                assign({ firstLevel: true }),
                choose([
                  {
                    guard: () => true,
                    actions: [
                      assign({ secondLevel: true }),
                      choose([
                        {
                          guard: () => true,
                          actions: [assign({ thirdLevel: true })]
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

    const service = createActor(machine).start();

    expect(service.getSnapshot().context).toEqual({
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
    const machine = createMachine({
      types: {} as { context: Ctx },
      context: {
        counter: 101
      },
      initial: 'foo',
      states: {
        foo: {
          entry: choose([
            {
              guard: ({ context }) => context.counter > 100,
              actions: assign({ answer: 42 })
            }
          ])
        }
      }
    });

    const service = createActor(machine).start();

    expect(service.getSnapshot().context).toEqual({ counter: 101, answer: 42 });
  });

  it('should provide event to a condition expression', () => {
    interface Ctx {
      answer?: number;
    }
    interface Events {
      type: 'NEXT';
      counter: number;
    }

    const machine = createMachine({
      types: {} as {
        context: Ctx;
        events: Events;
      },
      context: {},
      initial: 'foo',
      states: {
        foo: {
          on: {
            NEXT: {
              target: 'bar',
              actions: choose([
                {
                  guard: ({ event }) => event.counter > 100,
                  actions: assign({ answer: 42 })
                }
              ])
            }
          }
        },
        bar: {}
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT', counter: 101 });
    expect(service.getSnapshot().context).toEqual({ answer: 42 });
  });

  it('should be able to use actions and guards defined in options', () => {
    interface Ctx {
      answer?: number;
    }

    const machine = createMachine(
      {
        types: {} as { context: Ctx },
        context: {},
        initial: 'foo',
        states: {
          foo: {
            entry: choose([{ guard: 'worstGuard', actions: 'revealAnswer' }])
          }
        }
      },
      {
        guards: {
          worstGuard: () => true
        },
        actions: {
          revealAnswer: assign({ answer: 42 })
        }
      }
    );

    const service = createActor(machine).start();

    expect(service.getSnapshot().context).toEqual({ answer: 42 });
  });

  it('should be able to use choose actions from within options', () => {
    interface Ctx {
      answer?: number;
    }

    const machine = createMachine(
      {
        types: {} as { context: Ctx },
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
          revealAnswer: assign({ answer: 42 }),
          conditionallyRevealAnswer: choose([
            { guard: 'worstGuard', actions: 'revealAnswer' }
          ])
        }
      }
    );

    const service = createActor(machine).start();

    expect(service.getSnapshot().context).toEqual({ answer: 42 });
  });
});

describe('sendParent', () => {
  // https://github.com/statelyai/xstate/issues/711
  it('TS: should compile for any event', () => {
    interface ChildEvent {
      type: 'CHILD';
    }

    const child = createMachine({
      types: {} as {
        events: ChildEvent;
      },
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
    const childMachine = createMachine({
      types: {} as {
        events: { type: 'EVENT' };
      },
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

    const parentMachine = createMachine({
      types: {} as {
        context: {
          child: ActorRefFrom<typeof childMachine>;
        };
      },
      context: ({ spawn }) => ({
        child: spawn(childMachine)
      }),
      entry: sendTo(({ context }) => context.child, { type: 'EVENT' })
    });

    createActor(parentMachine).start();
  });

  it('should be able to send an event from expression to an actor', (done) => {
    const childMachine = createMachine({
      types: {} as {
        events: { type: 'EVENT'; count: number };
      },
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

    const parentMachine = createMachine({
      types: {} as {
        context: {
          child: ActorRefFrom<typeof childMachine>;
          count: number;
        };
      },
      context: ({ spawn }) => {
        return {
          child: spawn(childMachine, { id: 'child' }),
          count: 42
        };
      },
      entry: sendTo(
        ({ context }) => context.child,
        ({ context }) => ({ type: 'EVENT', count: context.count })
      )
    });

    createActor(parentMachine).start();
  });

  it('should report a type error for an invalid event', () => {
    const childMachine = createMachine({
      types: {} as {
        events: { type: 'EVENT' };
      },
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            EVENT: {}
          }
        }
      }
    });

    createMachine({
      types: {} as {
        context: {
          child: ActorRefFrom<typeof childMachine>;
        };
      },
      context: ({ spawn }) => ({
        child: spawn(childMachine)
      }),
      entry: sendTo(({ context }) => context.child, {
        // @ts-expect-error
        type: 'UNKNOWN'
      })
    });
  });

  it('should be able to send an event to a named actor', (done) => {
    const childMachine = createMachine({
      types: {} as {
        events: { type: 'EVENT' };
      },
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

    const parentMachine = createMachine({
      types: {} as { context: { child: ActorRefFrom<typeof childMachine> } },
      context: ({ spawn }) => ({
        child: spawn(childMachine, { id: 'child' })
      }),
      // No type-safety for the event yet
      entry: sendTo('child', { type: 'EVENT' })
    });

    createActor(parentMachine).start();
  });

  it('should be able to send an event directly to an ActorRef', (done) => {
    const childMachine = createMachine({
      types: {} as {
        events: { type: 'EVENT' };
      },
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

    const parentMachine = createMachine({
      types: {} as { context: { child: ActorRefFrom<typeof childMachine> } },
      context: ({ spawn }) => ({
        child: spawn(childMachine)
      }),
      entry: pure(({ context }) => {
        return [sendTo(context.child, { type: 'EVENT' })];
      })
    });

    createActor(parentMachine).start();
  });

  it('should be able to read from event', () => {
    expect.assertions(1);
    const machine = createMachine({
      types: {} as {
        context: Record<string, CallbackActorRef<EventObject>>;
        events: { type: 'EVENT'; value: string };
      },
      initial: 'a',
      context: ({ spawn }) => ({
        foo: spawn(
          fromCallback(({ receive }) => {
            receive((event) => {
              expect(event).toEqual({ type: 'EVENT' });
            });
          })
        )
      }),
      states: {
        a: {
          on: {
            EVENT: {
              actions: sendTo(({ context, event }) => context[event.value], {
                type: 'EVENT'
              })
            }
          }
        }
      }
    });

    const service = createActor(machine).start();

    service.send({ type: 'EVENT', value: 'foo' });
  });

  // TODO: figure out how to best test this
  it.skip('should throw if given a string', () => {
    const machine = createMachine({
      invoke: {
        id: 'child',
        src: fromCallback(() => {})
      },
      entry: sendTo('child', 'a string')
    });

    expect(() => {
      createActor(machine).start();
    }).toThrowErrorMatchingInlineSnapshot(
      `"Only event objects may be used with sendTo; use sendTo({ type: "a string" }) instead"`
    );
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

    const service = createActor(machine).start();

    service.subscribe({ complete: () => done() });

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

    const service = createActor(machine).start();

    // The state should not be changed yet; `delay: 0` is equivalent to `setTimeout(..., 0)`
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

    const service = createActor(machine).start();

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

    const service = createActor(machine).start();

    service.subscribe({ complete: () => done() });

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

    const actor = createActor(machine).start();

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
    const machine = createMachine({
      types: {} as { context: MachineContext; events: MachineEvent },
      initial: 'a',
      context: {
        eventType: 'RAISED'
      },
      states: {
        a: {
          on: {
            NEXT: {
              actions: raise(({ context }) => ({
                type: context.eventType
              }))
            },
            RAISED: 'b'
          }
        },
        b: {}
      }
    });

    const actor = createActor(machine).start();

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
              actions: cancel('myId')
            }
          }
        },
        b: {}
      }
    });

    const actor = createActor(machine).start();

    actor.send({ type: 'CANCEL' });

    setTimeout(() => {
      expect(actor.getSnapshot().value).toBe('a');
    }, 10);
  });

  // TODO: figure out how to best test this
  it.skip('should throw if given a string', () => {
    const machine = createMachine({
      entry: raise(
        // @ts-ignore
        'a string'
      )
    });

    expect(() => {
      createActor(machine).start();
    }).toThrowErrorMatchingInlineSnapshot(
      `"Only event objects may be used with raise; use raise({ type: "a string" }) instead"`
    );
  });
});

describe('assign action order', () => {
  it('should preserve action order', () => {
    const captured: number[] = [];

    const machine = createMachine({
      types: {} as {
        context: { count: number };
      },
      context: { count: 0 },
      entry: [
        ({ context }) => captured.push(context.count), // 0
        assign({ count: ({ context }) => context.count + 1 }),
        ({ context }) => captured.push(context.count), // 1
        assign({ count: ({ context }) => context.count + 1 }),
        ({ context }) => captured.push(context.count) // 2
      ]
    });

    createActor(machine).start();

    expect(captured).toEqual([0, 1, 2]);
  });

  it('should deeply preserve action order', () => {
    const captured: number[] = [];

    interface CountCtx {
      count: number;
    }

    const machine = createMachine(
      {
        types: {} as {
          context: CountCtx;
        },
        context: { count: 0 },
        entry: [
          ({ context }) => captured.push(context.count), // 0
          pure(() => {
            return [
              assign({ count: ({ context }) => context.count + 1 }),
              { type: 'capture' }, // 1
              assign({ count: ({ context }) => context.count + 1 })
            ];
          }),
          ({ context }) => captured.push(context.count) // 2
        ]
      },
      {
        actions: {
          capture: ({ context }) => captured.push(context.count)
        }
      }
    );

    createActor(machine).start();

    expect(captured).toEqual([0, 1, 2]);
  });

  it('should capture correct context values on subsequent transitions', () => {
    let captured: number[] = [];

    const machine = createMachine({
      types: {} as {
        context: { counter: number };
      },
      context: {
        counter: 0
      },
      on: {
        EV: {
          actions: [
            assign({ counter: ({ context }) => context.counter + 1 }),
            ({ context }) => captured.push(context.counter)
          ]
        }
      }
    });

    const service = createActor(machine).start();

    service.send({ type: 'EV' });
    service.send({ type: 'EV' });

    expect(captured).toEqual([1, 2]);
  });
});

describe('types', () => {
  it('assign actions should be inferred correctly', () => {
    createMachine({
      types: {} as {
        context: { count: number; text: string };
        events: { type: 'inc'; value: number } | { type: 'say'; value: string };
      },
      context: {
        count: 0,
        text: 'hello'
      },
      entry: [
        assign({ count: 31 }),
        // @ts-expect-error
        assign({ count: 'string' }),

        assign({ count: () => 31 }),
        // @ts-expect-error
        assign({ count: () => 'string' }),

        assign({ count: ({ context }) => context.count + 31 }),
        // @ts-expect-error
        assign({ count: ({ context }) => context.text + 31 }),

        assign(() => ({ count: 31 })),
        // @ts-expect-error
        assign(() => ({ count: 'string' })),

        assign(({ context }) => ({ count: context.count + 31 })),
        // @ts-expect-error
        assign(({ context }) => ({ count: context.text + 31 }))
      ],
      on: {
        say: {
          actions: [
            assign({ text: ({ event }) => event.value }),
            // @ts-expect-error
            assign({ count: ({ event }) => event.value }),

            assign(({ event }) => ({ text: event.value })),
            // @ts-expect-error
            assign(({ event }) => ({ count: event.value }))
          ]
        }
      }
    });
  });

  it('choose actions should be inferred correctly', () => {
    createMachine({
      types: {} as {
        context: { count: number; text: string };
        events: { type: 'inc'; value: number } | { type: 'say'; value: string };
      },
      context: {
        count: 0,
        text: 'hello'
      },
      entry: [
        choose([{ actions: assign({ count: 31 }) }]),
        // @ts-expect-error
        choose([{ actions: assign({ count: 'string' }) }]),

        choose([{ actions: assign({ count: () => 31 }) }]),
        // @ts-expect-error
        choose([{ actions: assign({ count: () => 'string' }) }]),

        choose([
          { actions: assign({ count: ({ context }) => context.count + 31 }) }
        ]),
        choose([
          // @ts-expect-error
          { actions: assign({ count: ({ context }) => context.text + 31 }) }
        ]),

        choose([{ actions: assign(() => ({ count: 31 })) }]),
        // @ts-expect-error
        choose([{ actions: assign(() => ({ count: 'string' })) }]),

        choose([
          { actions: assign(({ context }) => ({ count: context.count + 31 })) }
        ]),
        choose([
          // @ts-expect-error
          { actions: assign(({ context }) => ({ count: context.text + 31 })) }
        ])
      ],
      on: {
        say: {
          actions: [
            choose([{ actions: assign({ text: ({ event }) => event.value }) }]),
            choose([
              // @ts-expect-error
              { actions: assign({ count: ({ event }) => event.value }) }
            ]),

            choose([
              { actions: assign(({ event }) => ({ text: event.value })) }
            ]),
            choose([
              // @ts-expect-error
              { actions: assign(({ event }) => ({ count: event.value })) }
            ])
          ]
        }
      }
    });
  });
});

describe('action meta', () => {
  it.todo(
    'base action objects should have meta.action as the same base action object'
  );

  it('should provide self', () => {
    expect.assertions(1);

    const machine = createMachine({
      entry: ({ self }) => {
        expect(self.send).toBeDefined();
      }
    });

    createActor(machine).start();
  });
});

describe('actions', () => {
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
    const service = createActor(machine).start();
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
    const service = createActor(machine).start();
    service.send({ type: 'FOO' });

    expect(actual).toEqual(['a1', 'b']);
  });

  it('should call an inline action responding to an initial raise with the raised event', () => {
    const spy = jest.fn();

    const machine = createMachine({
      entry: raise({ type: 'HELLO' }),
      on: {
        HELLO: {
          actions: ({ event }) => {
            spy(event);
          }
        }
      }
    });

    createActor(machine).start();

    expect(spy).toHaveBeenCalledWith({ type: 'HELLO' });
  });

  it('should call a referenced action responding to an initial raise with the raised event', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        entry: raise({ type: 'HELLO' }),
        on: {
          HELLO: {
            actions: 'foo'
          }
        }
      },
      {
        actions: {
          foo: ({ event }) => {
            spy(event);
          }
        }
      }
    );

    createActor(machine).start();

    expect(spy).toHaveBeenCalledWith({ type: 'HELLO' });
  });

  it('should call an inline action responding to an initial raise with updated (non-initial) context', () => {
    const spy = jest.fn();

    const machine = createMachine({
      context: { count: 0 },
      entry: [assign({ count: 42 }), raise({ type: 'HELLO' })],
      on: {
        HELLO: {
          actions: ({ context }) => {
            spy(context);
          }
        }
      }
    });

    createActor(machine).start();

    expect(spy).toHaveBeenCalledWith({ count: 42 });
  });

  it('should call a referenced action responding to an initial raise with updated (non-initial) context', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        context: { count: 0 },
        entry: [assign({ count: 42 }), raise({ type: 'HELLO' })],
        on: {
          HELLO: {
            actions: 'foo'
          }
        }
      },
      {
        actions: {
          foo: ({ context }) => {
            spy(context);
          }
        }
      }
    );

    createActor(machine).start();

    expect(spy).toHaveBeenCalledWith({ count: 42 });
  });

  it('should call inline entry custom action with undefined parametrized action object', () => {
    const spy = jest.fn();
    createActor(
      createMachine({
        entry: (_, params) => {
          spy(params);
        }
      })
    ).start();

    expect(spy).toHaveBeenCalledWith(undefined);
  });

  it('should call inline entry builtin action with undefined parametrized action object', () => {
    const spy = jest.fn();
    createActor(
      createMachine({
        entry: assign((_, params) => {
          spy(params);
          return {};
        })
      })
    ).start();

    expect(spy).toHaveBeenCalledWith(undefined);
  });

  it('should call inline transition custom action with undefined parametrized action object', () => {
    const spy = jest.fn();

    const actorRef = createActor(
      createMachine({
        on: {
          FOO: {
            actions: (_, params) => {
              spy(params);
            }
          }
        }
      })
    ).start();
    actorRef.send({ type: 'FOO' });

    expect(spy).toHaveBeenCalledWith(undefined);
  });

  it('should call inline transition builtin action with undefined parameters', () => {
    const spy = jest.fn();

    const actorRef = createActor(
      createMachine({
        on: {
          FOO: {
            actions: assign((_, params) => {
              spy(params);
              return {};
            })
          }
        }
      })
    ).start();
    actorRef.send({ type: 'FOO' });

    expect(spy).toHaveBeenCalledWith(undefined);
  });

  it('should call a referenced custom action with undefined params when it has no params and it is referenced using a string', () => {
    const spy = jest.fn();

    createActor(
      createMachine(
        {
          entry: 'myAction'
        },
        {
          actions: {
            myAction: (_, params) => {
              spy(params);
            }
          }
        }
      )
    ).start();

    expect(spy).toHaveBeenCalledWith(undefined);
  });

  it('should call a referenced builtin action with undefined params when it has no params and it is referenced using a string', () => {
    const spy = jest.fn();

    createActor(
      createMachine(
        {
          entry: 'myAction'
        },
        {
          actions: {
            myAction: assign((_, params) => {
              spy(params);
              return {};
            })
          }
        }
      )
    ).start();

    expect(spy).toHaveBeenCalledWith(undefined);
  });

  it('should call a referenced custom action with the provided parametrized action object', () => {
    const spy = jest.fn();

    createActor(
      createMachine(
        {
          entry: {
            type: 'myAction',
            params: {
              foo: 'bar'
            }
          }
        },
        {
          actions: {
            myAction: (_, params) => {
              spy(params);
            }
          }
        }
      )
    ).start();

    expect(spy).toHaveBeenCalledWith({
      foo: 'bar'
    });
  });

  it('should call a referenced builtin action with the provided parametrized action object', () => {
    const spy = jest.fn();

    createActor(
      createMachine(
        {
          entry: {
            type: 'myAction',
            params: {
              foo: 'bar'
            }
          }
        },
        {
          actions: {
            myAction: assign((_, params) => {
              spy(params);
              return {};
            })
          }
        }
      )
    ).start();

    expect(spy).toHaveBeenCalledWith({
      foo: 'bar'
    });
  });

  it('should call a referenced custom action with undefined params when it has no params and it is referenced by an inline pure', () => {
    const spy = jest.fn();

    createActor(
      createMachine(
        {
          entry: pure(() => ['myAction'])
        },
        {
          actions: {
            myAction: (_, params) => {
              spy(params);
              return {};
            }
          }
        }
      )
    ).start();

    expect(spy).toHaveBeenCalledWith(undefined);
  });

  it('should call a referenced builtin action with undefined params when it has no params and it is referenced by an inline pure', () => {
    const spy = jest.fn();

    createActor(
      createMachine(
        {
          entry: pure(() => ['myAction'])
        },
        {
          actions: {
            myAction: assign((_, params) => {
              spy(params);
              return {};
            })
          }
        }
      )
    ).start();

    expect(spy).toHaveBeenCalledWith(undefined);
  });

  it('should call a referenced custom action with undefined params when it has no params and it is referenced by a referenced pure', () => {
    const spy = jest.fn();

    createActor(
      createMachine(
        {
          entry: 'myPure'
        },
        {
          actions: {
            myPure: pure(() => ['myAction']),
            myAction: (_, params) => {
              spy(params);
              return {};
            }
          }
        }
      )
    ).start();

    expect(spy).toHaveBeenCalledWith(undefined);
  });

  it('should call a referenced builtin action with undefined params when it has no params and it is referenced by a referenced pure', () => {
    const spy = jest.fn();

    createActor(
      createMachine(
        {
          entry: 'myPure'
        },
        {
          actions: {
            myPure: pure(() => ['myAction']),
            myAction: assign((_, params) => {
              spy(params);
              return {};
            })
          }
        }
      )
    ).start();

    expect(spy).toHaveBeenCalledWith(undefined);
  });
});
