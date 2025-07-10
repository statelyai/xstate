import { sleep } from '@xstate-repo/jest-utils';

import { fromCallback } from '../src/actors/callback.ts';
import { AnyActorRef, createActor, next_createMachine } from '../src/index.ts';
import { trackEntries } from './utils.ts';
import z from 'zod';

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

describe.only('entry/exit actions', () => {
  describe('State.actions', () => {
    it('should return the entry actions of an initial state', () => {
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
        type: 'parallel',
        states: {
          a: {
            initial: 'a1',
            states: {
              a1: {
                on: {
                  CHANGE: (_, enq) => {
                    enq.action(() => actual.push('do_a2'));
                    enq.action(() => actual.push('another_do_a2'));
                    return { target: 'a2' };
                  }
                },
                entry: (_, enq) => enq.action(() => actual.push('enter_a1')),
                exit: (_, enq) => enq.action(() => actual.push('exit_a1'))
              },
              a2: {
                entry: (_, enq) => enq.action(() => actual.push('enter_a2')),
                exit: (_, enq) => enq.action(() => actual.push('exit_a2'))
              }
            },
            entry: (_, enq) => enq.action(() => actual.push('enter_a')),
            exit: (_, enq) => enq.action(() => actual.push('exit_a'))
          },
          b: {
            initial: 'b1',
            states: {
              b1: {
                on: {
                  CHANGE: (_, enq) => {
                    enq.action(() => actual.push('do_b2'));
                    return { target: 'b2' };
                  }
                },
                entry: (_, enq) => enq.action(() => actual.push('enter_b1')),
                exit: (_, enq) => enq.action(() => actual.push('exit_b1'))
              },
              b2: {
                entry: (_, enq) => enq.action(() => actual.push('enter_b2')),
                exit: (_, enq) => enq.action(() => actual.push('exit_b2'))
              }
            },
            entry: (_, enq) => enq.action(() => actual.push('enter_b')),
            exit: (_, enq) => enq.action(() => actual.push('exit_b'))
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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

      const machine = next_createMachine({
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
                  NEXT: (_, enq) => {
                    enq.action(transitionSpy);
                    return { target: 'a2' };
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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

    it.skip("shouldn't use a referenced custom action over a builtin one when there is a naming conflict", () => {
      // const spy = jest.fn();
      // const machine = next_createMachine(
      //   {
      //     context: {
      //       assigned: false
      //     },
      //     on: {
      //       EV: {
      //         actions: assign({ assigned: true })
      //       }
      //     }
      //   },
      //   {
      //     actions: {
      //       'xstate.assign': spy
      //     }
      //   }
      // );
      // const actor = createActor(machine).start();
      // actor.send({ type: 'EV' });
      // expect(spy).not.toHaveBeenCalled();
      // expect(actor.getSnapshot().context.assigned).toBe(true);
    });

    it.skip("shouldn't use a referenced custom action over an inline one when there is a naming conflict", () => {
      // const spy = jest.fn();
      // let called = false;
      // const machine = next_createMachine(
      //   {
      //     on: {
      //       EV: {
      //         // it's important for this test to use a named function
      //         actions: function myFn() {
      //           called = true;
      //         }
      //       }
      //     }
      //   },
      //   {
      //     actions: {
      //       myFn: spy
      //     }
      //   }
      // );
      // const actor = createActor(machine).start();
      // actor.send({ type: 'EV' });
      // expect(spy).not.toHaveBeenCalled();
      // expect(called).toBe(true);
    });

    it('root entry/exit actions should be called on root reentering transitions', () => {
      let entrySpy = jest.fn();
      let exitSpy = jest.fn();

      const machine = next_createMachine({
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
        const machine = next_createMachine({
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
        const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const m = next_createMachine({
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
      const m = next_createMachine({
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
      const m = next_createMachine({
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
      const m = next_createMachine({
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
      const m = next_createMachine({
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
      const m = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const parent = next_createMachine({
        initial: 'one',
        on: {
          WHATEVER: (_, enq) => {
            enq.action(() => {});
            return {};
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
      const machine = next_createMachine({
        initial: 'one',
        states: {
          one: {
            after: {
              10: (_, enq) => {
                enq.action(() => {
                  // do something
                });
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
      const childMachine = next_createMachine({
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

      const parentMachine = next_createMachine({
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

      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const child = next_createMachine({
        id: 'child',
        initial: 'idle',
        states: {
          idle: {
            exit: ({ parent }) => {
              parent?.send({ type: 'EXIT' });
            }
          }
        }
      });

      const parent = next_createMachine({
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
      const child = next_createMachine({
        id: 'child',
        initial: 'idle',
        states: {
          idle: {
            exit: ({ parent }) => {
              parent?.send({ type: 'EXIT' });
            }
          }
        }
      });

      const parent = next_createMachine({
        // types: {} as {
        //   context: {
        //     child: ActorRefFromLogic<typeof child>;
        //   };
        // },
        id: 'parent',
        context: ({ spawn }) => ({
          child: spawn(child)
        }),
        on: {
          STOP_CHILD: ({ context }) => {
            context.child.stop();
          },
          EXIT: () => {
            throw new Error('This should not be called.');
          }
        }
      });

      const interpreter = createActor(parent).start();
      interpreter.send({ type: 'STOP_CHILD' });
    });

    it('sent events from exit handlers of a done child should be received by the parent ', () => {
      let eventReceived = false;

      const child = next_createMachine({
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
        exit: ({ parent }) => {
          parent?.send({ type: 'CHILD_DONE' });
        }
      });

      const parent = next_createMachine({
        // types: {} as {
        //   context: {
        //     child: ActorRefFromLogic<typeof child>;
        //   };
        // },
        id: 'parent',
        context: ({ spawn }) => ({
          child: spawn(child)
        }),
        on: {
          FINISH_CHILD: ({ context }) => {
            context.child.send({ type: 'FINISH' });
          },
          CHILD_DONE: (_, enq) => {
            enq.action(() => {
              eventReceived = true;
            });
          }
        }
      });

      const interpreter = createActor(parent).start();
      interpreter.send({ type: 'FINISH_CHILD' });

      expect(eventReceived).toBe(true);
    });

    it('sent events from exit handlers of a stopped child should not be received by its children', () => {
      const spy = jest.fn();

      const grandchild = next_createMachine({
        id: 'grandchild',
        on: {
          STOPPED: (_, enq) => {
            enq.action(spy);
          }
        }
      });

      const child = next_createMachine({
        id: 'child',
        invoke: {
          id: 'myChild',
          src: grandchild
        },
        exit: ({ context }) => {
          context.myChild.send({ type: 'STOPPED' });
        }
      });

      const parent = next_createMachine({
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

    it.only('sent events from exit handlers of a done child should be received by its children', () => {
      const spy = jest.fn();

      const grandchild = next_createMachine({
        id: 'grandchild',
        on: {
          // STOPPED: {
          //   actions: spy
          // }
          STOPPED: (_, enq) => {
            enq.action(spy);
          }
        }
      });

      const child = next_createMachine({
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
        exit: ({ children }, enq) => {
          enq.sendTo(children.myChild, { type: 'STOPPED' });
        }
      });

      const parent = next_createMachine({
        id: 'parent',
        invoke: {
          id: 'myChild',
          src: child
        },
        on: {
          NEXT: ({ children }, enq) => {
            enq.sendTo(children.myChild, { type: 'FINISH' });
          }
        }
      });

      const actor = createActor(parent).start();
      actor.send({ type: 'NEXT' });

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('actors spawned in exit handlers of a stopped child should not be started', () => {
      const grandchild = next_createMachine({
        id: 'grandchild',
        entry: () => {
          throw new Error('This should not be called.');
        }
      });

      const parent = next_createMachine({
        id: 'parent',
        context: {},
        // exit: assign({
        //   actorRef: ({ spawn }) => spawn(grandchild)
        // })
        exit: (_, enq) => {
          return {
            context: {
              actorRef: enq.spawn(grandchild)
            }
          };
        }
      });

      const interpreter = createActor(parent).start();
      interpreter.stop();
    });

    it('should note execute referenced custom actions correctly when stopping an interpreter', () => {
      const referencedActionSpy = jest.fn();
      const parent = next_createMachine(
        {
          id: 'parent',
          context: {},
          exit: (_, enq) => {
            enq.action(referencedActionSpy);
          }
        }
        // {
        //   actions: {
        //     referencedAction: spy
        //   }
        // }
      );

      const interpreter = createActor(parent).start();
      interpreter.stop();

      expect(referencedActionSpy).not.toHaveBeenCalled();
    });

    it('should not execute builtin actions when stopping an interpreter', () => {
      const machine = next_createMachine(
        {
          context: {
            executedAssigns: [] as string[]
          },
          // exit: [
          //   'referencedAction',
          //   assign({
          //     executedAssigns: ({ context }) => [
          //       ...context.executedAssigns,
          //       'inline'
          //     ]
          //   })
          // ]
          exit: ({ context }) => {
            return {
              context: {
                ...context,
                executedAssigns: [...context.executedAssigns, 'referenced']
              }
            };
          }
        }
        // {
        //   actions: {
        //     referencedAction: assign({
        //       executedAssigns: ({ context }) => [
        //         ...context.executedAssigns,
        //         'referenced'
        //       ]
        //     })
        //   }
        // }
      );

      const interpreter = createActor(machine).start();
      interpreter.stop();

      expect(interpreter.getSnapshot().context.executedAssigns).toEqual([]);
    });

    it('should clear all scheduled events when the interpreter gets stopped', () => {
      const machine = next_createMachine({
        on: {
          // INITIALIZE_SYNC_SEQUENCE: {
          //   actions: () => {
          //     // schedule those 2 events
          //     service.send({ type: 'SOME_EVENT' });
          //     service.send({ type: 'SOME_EVENT' });
          //     // but also immediately stop *while* the `INITIALIZE_SYNC_SEQUENCE` is still being processed
          //     service.stop();
          //   }
          // },
          INITIALIZE_SYNC_SEQUENCE: (_, enq) => {
            enq.action(() => {
              service.send({ type: 'SOME_EVENT' });
              service.send({ type: 'SOME_EVENT' });
              service.stop();
            });
          },
          SOME_EVENT: (_, enq) => {
            enq.action(() => {
              throw new Error('This should not be called.');
            });
          }
        }
      });

      const service = createActor(machine).start();

      service.send({ type: 'INITIALIZE_SYNC_SEQUENCE' });
    });

    it('should execute exit actions of the settled state of the last initiated microstep', () => {
      const exitActions: string[] = [];
      const machine = next_createMachine({
        initial: 'foo',
        states: {
          foo: {
            exit: (_, enq) => {
              enq.action(() => {
                exitActions.push('foo action');
              });
            },
            on: {
              // INITIALIZE_SYNC_SEQUENCE: {
              //   target: 'bar',
              //   actions: [
              //     () => {
              //       // immediately stop *while* the `INITIALIZE_SYNC_SEQUENCE` is still being processed
              //       service.stop();
              //     },
              //     () => {}
              //   ]
              // },
              INITIALIZE_SYNC_SEQUENCE: (_, enq) => {
                enq.action(() => {
                  service.stop();
                });
                return { target: 'bar' };
              }
            }
          },
          bar: {
            exit: (_, enq) => {
              enq.action(() => {
                exitActions.push('bar action');
              });
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
      const machine = next_createMachine({
        initial: 'foo',
        states: {
          foo: {
            exit: (_, enq) => {
              enq.action(() => executedActions.push('foo exit action'));
            },
            on: {
              // INITIALIZE_SYNC_SEQUENCE: {
              //   target: 'bar',
              //   actions: [
              //     () => {
              //       // immediately stop *while* the `INITIALIZE_SYNC_SEQUENCE` is still being processed
              //       service.stop();
              //     },
              //     () => {
              //       executedActions.push('foo transition action');
              //     }
              //   ]
              // }
              INITIALIZE_SYNC_SEQUENCE: (_, enq) => {
                enq.action(() => {
                  // immediately stop *while* the `INITIALIZE_SYNC_SEQUENCE` is still being processed
                  service.stop();
                });
                enq.action(() => {
                  executedActions.push('foo transition action');
                });
                return { target: 'bar' };
              }
            }
          },
          bar: {
            exit: (_, enq) => {
              enq.action(() => {
                executedActions.push('bar exit action');
              });
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
    const machine = next_createMachine({
      // initial: {
      //   target: 'a',
      //   actions: () => actual.push('initialA')
      // },
      initial: (_, enq) => {
        enq.action(() => {
          actual.push('initialA');
        });
        return { target: 'a' };
      },
      states: {
        a: {
          entry: (_, enq) => {
            enq.action(() => {
              actual.push('entryA');
            });
          }
        }
      }
    });
    createActor(machine).start();
    expect(actual).toEqual(['initialA', 'entryA']);
  });

  it('should support initial actions from transition', () => {
    const actual: string[] = [];
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          entry: (_, enq) => {
            enq.action(() => {
              actual.push('entryB');
            });
          },
          // initial: {
          //   target: 'foo',
          //   actions: () => actual.push('initialFoo');
          //   });
          // }
          // },
          initial: 'foo',
          states: {
            foo: {
              entry: (_, enq) => {
                enq.action(() => {
                  actual.push('initialFoo');
                });
                enq.action(() => {
                  actual.push('entryFoo');
                });
              }
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
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          // initial: {
          //   target: 'b_child',
          //   actions: () => spy('initial in b')
          // },
          initial: (_, enq) => {
            enq.action(() => {
              spy('initial in b');
            });
            return { target: 'b_child' };
          },
          states: {
            b_child: {
              // initial: {
              //   target: 'b_granchild',
              //   actions: () => spy('initial in b_child')
              // },
              initial: (_, enq) => {
                enq.action(() => {
                  spy('initial in b_child');
                });
                return { target: 'b_granchild' };
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
    const machine = next_createMachine({
      // initial: {
      //   target: 'a',
      //   actions: () => spy('root')
      // },
      initial: (_, enq) => {
        enq.action(() => {
          spy('root');
        });
        return { target: 'a' };
      },
      states: {
        a: {
          // initial: {
          //   target: 'a1',
          //   actions: () => spy('inner')
          // },
          initial: (_, enq) => {
            enq.action(() => {
              spy('inner');
            });
            return { target: 'a1' };
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
    const machine = next_createMachine({
      id: 'root',
      // initial: {
      //   target: 'a',
      //   actions: spy
      // },
      initial: (_, enq) => {
        enq.action(() => {
          spy();
        });
        return { target: 'a' };
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
    const machine = next_createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            // STOP: {
            //   target: 'stop',
            //   actions: [spy]
            // }
            STOP: (_, enq) => {
              enq.action(spy);
              return { target: 'stop' };
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
  const definedAction = () => {};

  it('should reference actions defined in actions parameter of machine options (entry actions)', () => {
    const definedAction = jest.fn();
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: 'b'
          }
        },
        b: {
          // entry: ['definedAction', { type: 'definedAction' }, 'undefinedAction']
          entry: (_, enq) => {
            enq.action(definedAction);
            // actions are functions; no { type: 'definedAction' }
            // cannot use undefinedAction
          }
        }
      },
      on: {
        E: '.a'
      }
    });
    // .provide({
    //   actions: {
    //     definedAction: definedAction
    //   }
    // });

    const actor = createActor(machine).start();
    actor.send({ type: 'EVENT' });

    expect(definedAction).toHaveBeenCalledTimes(2);
  });

  it('should reference actions defined in actions parameter of machine options (initial state)', () => {
    const definedAction = jest.fn();
    const machine = next_createMachine(
      {
        // entry: ['definedAction', { type: 'definedAction' }, 'undefinedAction']
        entry: (_, enq) => {
          enq.action(definedAction);
          // actions are functions; no { type: 'definedAction' }
          // cannot use undefinedAction
        }
      }
      // {
      //   actions: {
      //     definedAction: definedAction
      //   }
      // }
    );

    createActor(machine).start();

    expect(definedAction).toHaveBeenCalledTimes(2);
  });

  it('should be able to reference action implementations from action objects', () => {
    const machine = next_createMachine(
      {
        // types: {} as { context: Context; events: EventType },
        initial: 'a',
        context: {
          count: 0
        },
        states: {
          a: {
            // entry: [
            //   'definedAction',
            //   { type: 'definedAction' },
            //   'undefinedAction'
            // ],
            entry: (_, enq) => {
              enq.action(definedAction);
              // enq.action({ type: 'updateContext' });
              return {
                context: {
                  count: 10
                }
              };
            },
            on: {
              // EVENT: {
              //   target: 'b',
              //   actions: [{ type: 'definedAction' }, { type: 'updateContext' }]
              // }
              EVENT: (_, enq) => {
                enq.action(definedAction);
                return { target: 'b', context: { count: 10 } };
              }
            }
          },
          b: {}
        }
      }
      // {
      //   actions: {
      //     definedAction,
      //     updateContext: assign({ count: 10 })
      //   }
      // }
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

    const anonMachine = next_createMachine({
      id: 'anon',
      initial: 'active',
      states: {
        active: {
          entry: (_, enq) => {
            enq.action(() => {
              entryCalled = true;
            });
          },
          exit: (_, enq) => {
            enq.action(() => {
              exitCalled = true;
            });
          },
          on: {
            // EVENT: {
            //   target: 'inactive',
            //   actions: [() => (actionCalled = true)]
            // }
            EVENT: (_, enq) => {
              enq.action(() => {
                actionCalled = true;
              });
              return { target: 'inactive' };
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
    const entryAction = jest.fn();

    const testMachine = next_createMachine(
      {
        id: 'test',
        initial: 'foo',
        states: {
          foo: {
            // entry: {
            //   type: 'entryAction',
            //   params: {
            //     value: 'something'
            //   }
            // }
            entry: (_, enq) => {
              enq.action(entryAction, { value: 'something' });
            }
          }
        }
      }
      // {
      //   actions: {
      //     entryAction: (_, params) => {
      //       spy(params);
      //     }
      //   }
      // }
    );

    createActor(testMachine).start();

    expect(entryAction).toHaveBeenCalledWith({
      value: 'something'
    });
  });

  it('should provide undefined params when it was configured as string', () => {
    const entryAction = jest.fn();

    const testMachine = next_createMachine(
      {
        id: 'test',
        initial: 'foo',
        states: {
          foo: {
            entry: (_, enq) => {
              enq.action(entryAction);
            }
          }
        }
      }
      // {
      //   actions: {
      //     entryAction: (_, params) => {
      //       entryAction(params);
      //     }
      //   }
      // }
    );

    createActor(testMachine).start();

    expect(entryAction).toHaveBeenCalledWith(undefined);
  });

  it('should provide the action with resolved params when they are dynamic', () => {
    const entryAction = jest.fn();

    const machine = next_createMachine(
      {
        // entry: {
        //   type: 'entryAction',
        //   params: () => ({ stuff: 100 })
        // }
        entry: (_, enq) => {
          enq.action(entryAction, { stuff: 100 });
        }
      }
      // {
      //   actions: {
      //     entryAction: (_, params) => {
      //       entryAction(params);
      //     }
      //   }
      // }
    );

    createActor(machine).start();

    expect(entryAction).toHaveBeenCalledWith({
      stuff: 100
    });
  });

  it('should resolve dynamic params using context value', () => {
    const entryAction = jest.fn();

    const machine = next_createMachine(
      {
        context: {
          secret: 42
        },
        // entry: {
        //   type: 'entryAction',
        //   params: ({ context }) => ({ secret: context.secret })
        // }
        entry: ({ context }, enq) => {
          enq.action(entryAction, { secret: context.secret });
        }
      }
      // {
      //   actions: {
      //     entryAction: (_, params) => {
      //       spy(params);
      //     }
      //   }
      // }
    );

    createActor(machine).start();

    expect(entryAction).toHaveBeenCalledWith({
      secret: 42
    });
  });

  it('should resolve dynamic params using event value', () => {
    const spy = jest.fn();

    const machine = next_createMachine(
      {
        schemas: {
          event: z.object({
            secret: z.number()
          })
        },
        on: {
          // FOO: {
          //   actions: {
          //     type: 'myAction',
          //     params: ({ event }) => ({ secret: event.secret })
          //   }
          // }
          FOO: ({ event }, enq) => {
            enq.action(spy, { secret: event.secret });
          }
        }
      }
      // {
      //   actions: {
      //     myAction: (_, params) => {
      //       spy(params);
      //     }
      //   }
      // }
    );

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'FOO', secret: 77 });

    expect(spy).toHaveBeenCalledWith({
      secret: 77
    });
  });
});

describe('forwardTo()', () => {
  it('should forward an event to a service', (done) => {
    const child = next_createMachine({
      // types: {} as {
      //   events: {
      //     type: 'EVENT';
      //     value: number;
      //   };
      // },
      schemas: {
        event: z.object({
          value: z.number()
        })
      },
      id: 'child',
      initial: 'active',
      states: {
        active: {
          on: {
            // EVENT: {
            //   actions: sendParent({ type: 'SUCCESS' }),
            //   guard: ({ event }) => event.value === 42
            // }
            EVENT: ({ event, parent }) => {
              if (event.value === 42) {
                parent?.send({ type: 'SUCCESS' });
              }
            }
          }
        }
      }
    });

    const parent = next_createMachine({
      // types: {} as {
      //   events:
      //     | {
      //         type: 'EVENT';
      //         value: number;
      //       }
      //     | {
      //         type: 'SUCCESS';
      //       };
      // },
      schemas: {
        event: z.union([
          z.object({
            type: z.literal('EVENT'),
            value: z.number()
          }),
          z.object({
            type: z.literal('SUCCESS')
          })
        ])
      },
      id: 'parent',
      initial: 'first',
      states: {
        first: {
          invoke: { src: child, id: 'myChild' },
          on: {
            // EVENT: {
            //   actions: forwardTo('myChild')
            // },
            EVENT: ({ event, children }) => {
              children.myChild?.send(event);
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
    const child = next_createMachine({
      // types: {} as {
      //   events: {
      //     type: 'EVENT';
      //     value: number;
      //   };
      // },
      schemas: {
        event: z.object({
          value: z.number()
        })
      },
      id: 'child',
      initial: 'active',
      states: {
        active: {
          on: {
            // EVENT: {
            //   actions: sendParent({ type: 'SUCCESS' }),
            //   guard: ({ event }) => event.value === 42
            // }
            EVENT: ({ event, parent }) => {
              if (event.value === 42) {
                parent?.send({ type: 'SUCCESS' });
              }
            }
          }
        }
      }
    });

    const parent = next_createMachine({
      // types: {} as {
      //   context: { child?: AnyActorRef };
      //   events: { type: 'EVENT'; value: number } | { type: 'SUCCESS' };
      // },
      schemas: {
        event: z.union([
          z.object({
            type: z.literal('EVENT'),
            value: z.number()
          }),
          z.object({
            type: z.literal('SUCCESS')
          })
        ])
      },
      id: 'parent',
      initial: 'first',
      context: {
        child: undefined as AnyActorRef | undefined
      },
      states: {
        first: {
          // entry: assign({
          //   child: ({ spawn }) => spawn(child, { id: 'x' })
          // }),
          entry: (_, enq) => {
            return {
              context: {
                child: enq.spawn(child, { id: 'x' })
              }
            };
          },
          on: {
            // EVENT: {
            //   actions: forwardTo(({ context }) => context.child!)
            // },
            EVENT: ({ context, event }) => {
              // enq.forwardTo(context.child!);
              context.child?.send(event);
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

  // Impossible to forward to undefined in v6
  it.skip('should not cause an infinite loop when forwarding to undefined', () => {
    const machine = next_createMachine({
      on: {
        // '*': { guard: () => true, actions: forwardTo(undefined as any) }
        '*': (_) => {
          // enq.forwardTo(undefined as any);
        }
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
    const machine = next_createMachine({
      // entry: log('some string', 'string label')
      entry: (_, enq) => {
        enq.log('some string', 'string label');
      }
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
    const machine = next_createMachine({
      context: {
        count: 42
      },
      // entry: log(({ context }) => `expr ${context.count}`, 'expr label')
      entry: ({ context }, enq) => {
        enq.log(`expr ${context.count}`, 'expr label');
      }
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

describe('enqueueActions', () => {
  it('should execute a simple referenced action', () => {
    const someAction = jest.fn();

    const machine = next_createMachine(
      {
        // entry: enqueueActions(({ enqueue }) => {
        //   enqueue('someAction');
        // })
        entry: (_, enq) => {
          enq.action(someAction);
        }
      }
      // {
      //   actions: {
      //     someAction: spy
      //   }
      // }
    );

    createActor(machine).start();

    expect(someAction).toHaveBeenCalledTimes(1);
  });

  it('should execute multiple different referenced actions', () => {
    const someAction = jest.fn();
    const otherAction = jest.fn();

    const machine = next_createMachine(
      {
        // entry: enqueueActions(({ enqueue }) => {
        //   enqueue('someAction');
        //   enqueue('otherAction');
        // })
        entry: (_, enq) => {
          enq.action(someAction);
          enq.action(otherAction);
        }
      }
      // {
      //   actions: {
      //     someAction: spy1,
      //     otherAction: spy2
      //   }
      // }
    );

    createActor(machine).start();

    expect(someAction).toHaveBeenCalledTimes(1);
    expect(otherAction).toHaveBeenCalledTimes(1);
  });

  it('should execute multiple same referenced actions', () => {
    const someAction = jest.fn();

    const machine = next_createMachine(
      {
        // entry: enqueueActions(({ enqueue }) => {
        //   enqueue('someAction');
        //   enqueue('someAction');
        // })
        entry: (_, enq) => {
          enq.action(someAction);
          enq.action(someAction);
        }
      }
      // {
      //   actions: {
      //     someAction: spy
      //   }
      // }
    );

    createActor(machine).start();

    expect(someAction).toHaveBeenCalledTimes(2);
  });

  it('should execute a parameterized action', () => {
    const someAction = jest.fn();

    const machine = next_createMachine(
      {
        // entry: enqueueActions(({ enqueue }) => {
        //   enqueue({
        //     type: 'someAction',
        //     params: { answer: 42 }
        //   });
        // })
        entry: (_, enq) => {
          enq.action(someAction, { answer: 42 });
        }
      }
      // {
      //   actions: {
      //     someAction: (_, params) => spy(params)
      //   }
      // }
    );

    createActor(machine).start();

    expect(someAction).toMatchMockCallsInlineSnapshot(`
      [
        [
          {
            "answer": 42,
          },
        ],
      ]
    `);
  });

  it('should execute a function', () => {
    const spy = jest.fn();

    const machine = next_createMachine({
      // entry: enqueueActions(({ enqueue }) => {
      //   enqueue(spy);
      // })
      entry: (_, enq) => {
        enq.action(spy);
      }
    });

    createActor(machine).start();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should execute a builtin action using its own action creator', () => {
    const spy = jest.fn();

    const machine = next_createMachine({
      on: {
        // FOO: {
        //   actions: enqueueActions(({ enqueue }) => {
        //     enqueue(
        //       raise({
        //         type: 'RAISED'
        //       })
        //     );
        //   })
        // },
        FOO: (_, enq) => {
          // enq.action(spy, { type: 'RAISED' });
          enq.raise({ type: 'RAISED' });
        },
        RAISED: (_, enq) => {
          enq.action(spy);
        }
        // RAISED: {
        //   actions: spy
        // }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'FOO' });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should execute a builtin action using its bound action creator', () => {
    const spy = jest.fn();

    const machine = next_createMachine({
      on: {
        // FOO: {
        //   actions: enqueueActions(({ enqueue }) => {
        //     enqueue.raise({
        //       type: 'RAISED'
        //     });
        //   })
        // },
        FOO: (_, enq) => {
          // enq.action(spy, { type: 'RAISED' });
          enq.raise({ type: 'RAISED' });
        },
        RAISED: (_, enq) => {
          enq.action(spy);
        }
        // RAISED: {
        //   actions: spy
        // }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'FOO' });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should execute assigns when resolving the initial snapshot', () => {
    const machine = next_createMachine({
      context: {
        count: 0
      },
      // entry: enqueueActions(({ enqueue }) => {
      //   enqueue.assign({
      //     count: 42
      //   });
      // })
      entry: () => ({
        context: {
          count: 42
        }
      })
    });

    const snapshot = createActor(machine).getSnapshot();

    expect(snapshot.context).toEqual({ count: 42 });
  });

  it('should be able to check a simple referenced guard', () => {
    const alwaysTrue = jest.fn().mockImplementation(() => true);
    const machine = next_createMachine(
      {
        context: {
          count: 0
        },
        // entry: enqueueActions(({ check }) => {
        //   check('alwaysTrue');
        // })
        entry: () => {
          if (alwaysTrue()) {
            // ...
          }
        }
      }
      // {
      //   guards: {
      //     alwaysTrue: spy
      //   }
      // }
    );

    createActor(machine);

    expect(alwaysTrue).toHaveBeenCalledTimes(1);
  });

  it('should be able to check a parameterized guard', () => {
    const alwaysTrue = jest.fn();

    const machine = next_createMachine(
      {
        context: {
          count: 0
        },
        // entry: enqueueActions(({ check }) => {
        //   check({
        //     type: 'alwaysTrue',
        //     params: {
        //       max: 100
        //     }
        //   });
        // })
        entry: () => {
          if (alwaysTrue({ max: 100 })) {
            // ...
          }
        }
      }
      // {
      //   guards: {
      //     alwaysTrue: (_, params) => {
      //       spy(params);
      //       return true;
      //     }
      //   }
      // }
    );

    createActor(machine);

    expect(alwaysTrue).toMatchMockCallsInlineSnapshot(`
      [
        [
          {
            "max": 100,
          },
        ],
      ]
    `);
  });

  it('should provide self', () => {
    expect.assertions(1);
    const machine = next_createMachine({
      // entry: enqueueActions(({ self }) => {
      //   expect(self.send).toBeDefined();
      // })
      entry: ({ self }) => {
        expect(self.send).toBeDefined();
      }
    });

    createActor(machine).start();
  });

  it('should be able to communicate with the parent using params', () => {
    type ParentEvent = { type: 'FOO' };

    // const childMachine = setup({
    //   types: {} as {
    //     input: {
    //       parent?: ActorRef<Snapshot<unknown>, ParentEvent>;
    //     };
    //     context: {
    //       parent?: ActorRef<Snapshot<unknown>, ParentEvent>;
    //     };
    //   },
    //   actions: {
    //     mySendParent: enqueueActions(
    //       ({ context, enqueue }, event: ParentEvent) => {
    //         if (!context.parent) {
    //           // it's here just for illustration purposes
    //           console.log(
    //             'WARN: an attempt to send an event to a non-existent parent'
    //           );
    //           return;
    //         }
    //         enqueue.sendTo(context.parent, event);
    //       }
    //     )
    //   }
    // })

    const childMachine = next_createMachine({
      context: ({ input }) => ({ parent: input.parent }),
      // entry: {
      //   type: 'mySendParent',
      //   params: {
      //     type: 'FOO'
      //   }
      // }
      entry: ({ context, event }, enq) => {
        if (!context.parent) {
          // ...
        }
        enq.sendTo(context.parent, { type: 'FOO' });
      }
    });

    const spy = jest.fn();

    const parentMachine =
      //  setup({
      //   types: {} as { events: ParentEvent },
      //   actors: {
      //     child: childMachine
      //   }
      // }).
      next_createMachine({
        on: {
          // FOO: {
          //   actions: spy
          // }
          FOO: (_, enq) => enq.action(spy)
        },
        invoke: {
          src: childMachine,
          input: ({ self }) => ({ parent: self })
        }
      });

    createActor(parentMachine).start();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should enqueue.sendParent', () => {
    interface ParentEvent {
      type: 'PARENT_EVENT';
    }

    // const childMachine = setup({
    //   types: {} as {
    //     events: ChildEvent;
    //   },
    //   actions: {
    //     sendToParent: enqueueActions(({ context, enqueue }) => {
    //       enqueue.sendParent({ type: 'PARENT_EVENT' });
    //     })
    //   }
    // })

    const childMachine = next_createMachine({
      // entry: 'sendToParent'
      entry: ({ parent }) => {
        parent?.send({ type: 'PARENT_EVENT' });
      }
    });

    const parentSpy = jest.fn();

    // const parentMachine = setup({
    //   types: {} as { events: ParentEvent },
    //   actors: {
    //     child: childMachine
    //   }
    // })

    const parentMachine = next_createMachine({
      on: {
        // PARENT_EVENT: {
        //   actions: parentSpy
        // }
        PARENT_EVENT: (_, enq) => {
          enq.action(parentSpy);
        }
      },
      invoke: {
        src: childMachine
      }
    });

    createActor(parentMachine).start();

    expect(parentSpy).toHaveBeenCalledTimes(1);
  });
});

describe('sendParent', () => {
  // https://github.com/statelyai/xstate/issues/711
  it('TS: should compile for any event', () => {
    interface ChildEvent {
      type: 'CHILD';
    }

    const child = next_createMachine({
      // types: {} as {
      //   events: ChildEvent;
      // },
      id: 'child',
      initial: 'start',
      states: {
        start: {
          // This should not be a TypeScript error
          // entry: [sendParent({ type: 'PARENT' })]
          entry: ({ parent }) => {
            parent?.send({ type: 'PARENT' });
          }
        }
      }
    });

    expect(child).toBeTruthy();
  });
});

describe('sendTo', () => {
  it('should be able to send an event to an actor', (done) => {
    const childMachine = next_createMachine({
      // types: {} as {
      //   events: { type: 'EVENT' };
      // },
      schemas: {
        event: z.object({ type: z.literal('EVENT') })
      },
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            // EVENT: {
            //   actions: () => done()
            // }
            EVENT: (_, enq) => {
              enq.action(done);
            }
          }
        }
      }
    });

    const parentMachine = next_createMachine({
      // types: {} as {
      //   context: {
      //     child: ActorRefFromLogic<typeof childMachine>;
      //   };
      // },
      context: ({ spawn }) => ({
        child: spawn(childMachine)
      }),
      // entry: sendTo(({ context }) => context.child, { type: 'EVENT' })
      entry: ({ context }, enq) => {
        // context.child.send({ type: 'EVENT' });
        enq.sendTo(context.child, { type: 'EVENT' });
      }
    });

    createActor(parentMachine).start();
  });

  it('should be able to send an event from expression to an actor', (done) => {
    const childMachine = next_createMachine({
      // types: {} as {
      //   events: { type: 'EVENT'; count: number };
      // },
      schemas: {
        event: z.object({
          type: z.literal('EVENT'),
          count: z.number()
        })
      },
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            // EVENT: {
            //   actions: () => done()
            // }
            EVENT: (_, enq) => {
              enq.action(done);
            }
          }
        }
      }
    });

    const parentMachine = next_createMachine({
      // types: {} as {
      //   context: {
      //     child: ActorRefFromLogic<typeof childMachine>;
      //     count: number;
      //   };
      // },
      context: ({ spawn }) => {
        return {
          child: spawn(childMachine, { id: 'child' }),
          count: 42
        };
      },
      // entry: sendTo(
      //   ({ context }) => context.child,
      //   ({ context }) => ({ type: 'EVENT', count: context.count })
      // )
      entry: ({ context }, enq) => {
        enq.sendTo(context.child, { type: 'EVENT', count: context.count });
      }
    });

    createActor(parentMachine).start();
  });

  it('should report a type error for an invalid event', () => {
    const childMachine = next_createMachine({
      // types: {} as {
      //   events: { type: 'EVENT' };
      // },
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            EVENT: {}
          }
        }
      }
    });

    next_createMachine({
      // types: {} as {
      //   context: {
      //     child: ActorRefFromLogic<typeof childMachine>;
      //   };
      // },
      context: ({ spawn }) => ({
        child: spawn(childMachine)
      }),
      // entry: sendTo(({ context }) => context.child, {
      //   // @ts-expect-error
      //   type: 'UNKNOWN'
      // })
      entry: ({ context }) => {
        context.child.send({
          // @ts-expect-error
          type: 'UNKNOWN'
        });
      }
    });
  });

  it('should be able to send an event to a named actor', (done) => {
    const childMachine = next_createMachine({
      // types: {} as {
      //   events: { type: 'EVENT' };
      // },
      schemas: {
        event: z.object({
          type: z.literal('EVENT')
        })
      },
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            // EVENT: {
            //   actions: () => done()
            // }
            EVENT: (_, enq) => {
              enq.action(done);
            }
          }
        }
      }
    });

    const parentMachine = next_createMachine({
      // types: {} as {
      //   context: { child: ActorRefFromLogic<typeof childMachine> };
      // },
      context: ({ spawn }) => ({
        child: spawn(childMachine, { id: 'child' })
      }),
      // No type-safety for the event yet
      // entry: sendTo('child', { type: 'EVENT' })
      entry: ({ context }, enq) => {
        // context.child.send({ type: 'EVENT' });
        enq.sendTo(context.child, { type: 'EVENT' });
      }
    });

    createActor(parentMachine).start();
  });

  it.skip('should be able to send an event directly to an ActorRef', (done) => {
    const childMachine = next_createMachine({
      // types: {} as {
      //   events: { type: 'EVENT' };
      // },
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            // EVENT: {
            //   actions: () => done()
            // }
            EVENT: (_, enq) => {
              enq.action(done);
            }
          }
        }
      }
    });

    const parentMachine = next_createMachine({
      // types: {} as {
      //   context: { child: ActorRefFromLogic<typeof childMachine> };
      // },
      context: ({ spawn }) => ({
        child: spawn(childMachine)
      }),
      // entry: sendTo(({ context }) => context.child, { type: 'EVENT' })
      entry: ({ context }, enq) => {
        enq.sendTo(context.child, { type: 'EVENT' });
      }
    });

    createActor(parentMachine).start();
  });

  it('should be able to read from event', () => {
    expect.assertions(1);
    const machine = next_createMachine({
      // types: {} as {
      //   context: Record<string, CallbackActorRef<EventObject>>;
      //   events: { type: 'EVENT'; value: string };
      // },
      schemas: {
        event: z.object({
          type: z.literal('EVENT'),
          value: z.any() // TODO: how do we represent actors
        })
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
            // EVENT: {
            //   actions: sendTo(({ context, event }) => context[event.value], {
            //     type: 'EVENT'
            //   })
            // }
            EVENT: ({ context, event }) => {
              context[event.value]?.send({ type: 'EVENT' });
            }
          }
        }
      }
    });

    const service = createActor(machine).start();

    service.send({ type: 'EVENT', value: 'foo' });
  });

  it('should error if given a string', () => {
    const machine = next_createMachine({
      invoke: {
        id: 'child',
        src: fromCallback(() => {})
      },
      // entry: sendTo('child', 'a string')
      entry: ({ children }, enq) => {
        // children.child?.send({ type: 'a string' });
        enq.sendTo(
          children.child,
          // @ts-ignore
          'a string'
        );
      }
    });

    const errorSpy = jest.fn();

    const actorRef = createActor(machine);
    actorRef.subscribe({
      error: errorSpy
    });
    actorRef.start();

    expect(errorSpy).toMatchMockCallsInlineSnapshot(`
      [
        [
          [Error: Only event objects may be used with sendTo; use sendTo({ type: "a string" }) instead],
        ],
      ]
    `);
  });

  it('a self-event "handler" of an event sent using sendTo should be able to read updated snapshot of self', () => {
    const spy = jest.fn();
    const machine = next_createMachine({
      context: {
        counter: 0
      },
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {
          // entry: [
          //   assign({ counter: 1 }),
          //   sendTo(({ self }) => self, { type: 'EVENT' })
          // ],
          entry: ({ self }) => {
            self.send({ type: 'EVENT' });
            return {
              context: {
                counter: 1
              }
            };
          },
          on: {
            // EVENT: {
            //   actions: ({ self }) => spy(self.getSnapshot().context),
            //   target: 'c'
            // }
            EVENT: ({ self }, enq) => {
              enq.action(spy, self.getSnapshot().context);
              return {
                target: 'c'
              };
            }
          }
        },
        c: {}
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'NEXT' });
    actorRef.send({ type: 'EVENT' });

    expect(spy).toMatchMockCallsInlineSnapshot(`
[
  [
    {
      "counter": 1,
    },
  ],
]
`);
  });

  it("should not attempt to deliver a delayed event to the spawned actor's ID that was stopped since the event was scheduled", async () => {
    const spy1 = jest.fn();

    const child1 = next_createMachine({
      on: {
        // PING: {
        //   actions: spy1
        // }
        PING: (_, enq) => enq.action(spy1)
      }
    });

    const spy2 = jest.fn();

    const child2 = next_createMachine({
      on: {
        PING: (_, enq) => enq.action(spy2)
      }
    });

    const machine =
      // setup({
      //   actors: {
      //     child1,
      //     child2
      //   }
      // }).
      next_createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              START: 'b'
            }
          },
          b: {
            // entry: [
            //   spawnChild('child1', {
            //     id: 'myChild'
            //   }),
            //   sendTo('myChild', { type: 'PING' }, { delay: 1 }),
            //   stopChild('myChild'),
            //   spawnChild('child2', {
            //     id: 'myChild'
            //   })
            // ]
            entry: ({ children }, enq) => {
              enq.spawn(child1, { id: 'myChild' });
              enq.sendTo(children['myChild'], { type: 'PING' }, { delay: 1 });
              enq.stop(children['myChild']);
              enq.spawn(child2, { id: 'myChild' });
            }
          }
        }
      });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'START' });

    await sleep(10);

    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);

    expect(console.warn).toMatchMockCallsInlineSnapshot(`
[
  [
    "Event "PING" was sent to stopped actor "myChild (x:1)". This actor has already reached its final state, and will not transition.
Event: {"type":"PING"}",
  ],
]
`);
  });

  it("should not attempt to deliver a delayed event to the invoked actor's ID that was stopped since the event was scheduled", async () => {
    const spy1 = jest.fn();

    const child1 = next_createMachine({
      on: {
        // PING: {
        //   actions: spy1
        // }
        PING: (_, enq) => enq.action(spy1)
      }
    });

    const spy2 = jest.fn();

    const child2 = next_createMachine({
      on: {
        PING: (_, enq) => enq.action(spy2)
      }
    });

    const machine =
      //  setup({
      //   actors: {
      //     child1,
      //     child2
      //   }
      // }).
      next_createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              START: 'b'
            }
          },
          b: {
            // entry: sendTo('myChild', { type: 'PING' }, { delay: 1 }),
            entry: ({ children }, enq) => {
              enq.sendTo(children['myChild'], { type: 'PING' }, { delay: 1 });
            },
            invoke: {
              src: child1,
              id: 'myChild'
            },
            on: {
              NEXT: 'c'
            }
          },
          c: {
            invoke: {
              src: child2,
              id: 'myChild'
            }
          }
        }
      });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'START' });
    actorRef.send({ type: 'NEXT' });

    await sleep(10);

    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);

    expect(console.warn).toMatchMockCallsInlineSnapshot(`
[
  [
    "Event "PING" was sent to stopped actor "myChild (x:1)". This actor has already reached its final state, and will not transition.
Event: {"type":"PING"}",
  ],
]
`);
  });
});

describe('raise', () => {
  it('should be able to send a delayed event to itself', (done) => {
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          // entry: raise(
          //   { type: 'EVENT' },
          //   {
          //     delay: 1
          //   }
          // ),
          entry: (_, enq) => {
            enq.raise({ type: 'EVENT' }, { delay: 1 });
          },
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

  it('should be able to send a delayed event to itself with delay = 0', async () => {
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          // entry: raise(
          //   { type: 'EVENT' },
          //   {
          //     delay: 0
          //   }
          // ),
          entry: (_, enq) => {
            enq.raise({ type: 'EVENT' }, { delay: 0 });
          },
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

    await sleep(0);
    // The state should be changed now
    expect(service.getSnapshot().value).toEqual('b');
  });

  it('should be able to raise an event and respond to it in the same state', () => {
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          entry: (_, enq) => {
            enq.raise({ type: 'TO_B' });
          },
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
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          entry: (_, enq) => {
            enq.raise({ type: 'TO_B' }, { delay: 100 });
          },
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
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: (_, enq) => {
              enq.raise({ type: 'RAISED' });
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
    const machine = next_createMachine({
      // types: {} as { context: MachineContext; events: MachineEvent },
      initial: 'a',
      context: {
        eventType: 'RAISED'
      },
      states: {
        a: {
          on: {
            NEXT: ({ context }, enq) => {
              enq.raise({ type: context.eventType });
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

  it('should error if given a string', () => {
    const machine = next_createMachine({
      // entry: raise(
      //   // @ts-ignore
      //   'a string'
      // )
      entry: (_, enq) => {
        enq.raise(
          // @ts-expect-error
          'a string'
        );
      }
    });

    const errorSpy = jest.fn();

    const actorRef = createActor(machine);
    actorRef.subscribe({
      error: errorSpy
    });
    actorRef.start();

    expect(errorSpy).toMatchMockCallsInlineSnapshot(`
      [
        [
          [Error: Only event objects may be used with raise; use raise({ type: "a string" }) instead],
        ],
      ]
    `);
  });
});

describe('cancel', () => {
  it('should be possible to cancel a raised delayed event', async () => {
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            // NEXT: {
            //   actions: raise({ type: 'RAISED' }, { delay: 1, id: 'myId' })
            // },
            NEXT: (_, enq) => {
              enq.raise({ type: 'RAISED' }, { delay: 1, id: 'myId' });
            },
            RAISED: 'b',
            // CANCEL: {
            //   actions: cancel('myId')
            // }
            CANCEL: (_, enq) => {
              enq.cancel('myId');
            }
          }
        },
        b: {}
      }
    });

    const actor = createActor(machine).start();

    // This should raise the 'RAISED' event after 1ms
    actor.send({ type: 'NEXT' });

    // This should cancel the 'RAISED' event
    actor.send({ type: 'CANCEL' });

    await new Promise<void>((res) => {
      setTimeout(() => {
        expect(actor.getSnapshot().value).toBe('a');
        res();
      }, 10);
    });
  });

  it('should cancel only the delayed event in the machine that scheduled it when canceling the event with the same ID in the machine that sent it first', async () => {
    const fooSpy = jest.fn();
    const barSpy = jest.fn();

    const machine = next_createMachine({
      invoke: [
        {
          id: 'foo',
          src: next_createMachine({
            id: 'foo',
            // entry: raise({ type: 'event' }, { id: 'sameId', delay: 100 }),
            entry: (_, enq) => {
              enq.raise({ type: 'event' }, { id: 'sameId', delay: 100 });
            },
            on: {
              // event: { actions: fooSpy },
              event: (_, enq) => enq.action(fooSpy),
              // cancel: { actions: cancel('sameId') }
              cancel: (_, enq) => enq.cancel('sameId')
            }
          })
        },
        {
          id: 'bar',
          src: next_createMachine({
            id: 'bar',
            entry: (_, enq) =>
              enq.raise({ type: 'event' }, { id: 'sameId', delay: 100 }),
            on: {
              // event: { actions: barSpy }
              event: (_, enq) => enq.action(barSpy)
            }
          })
        }
      ],
      on: {
        // cancelFoo: {
        //   actions: sendTo('foo', { type: 'cancel' })
        // }
        cancelFoo: ({ children }) => {
          children['foo']?.send({ type: 'cancel' });
        }
      }
    });
    const actor = createActor(machine).start();

    await sleep(50);

    // This will cause the foo actor to cancel its 'sameId' delayed event
    // This should NOT cancel the 'sameId' delayed event in the other actor
    actor.send({ type: 'cancelFoo' });

    await sleep(55);

    expect(fooSpy).not.toHaveBeenCalled();
    expect(barSpy).toHaveBeenCalledTimes(1);
  });

  it('should cancel only the delayed event in the machine that scheduled it when canceling the event with the same ID in the machine that sent it second', async () => {
    const fooSpy = jest.fn();
    const barSpy = jest.fn();

    const machine = next_createMachine({
      invoke: [
        {
          id: 'foo',
          src: next_createMachine({
            id: 'foo',
            entry: (_, enq) =>
              enq.raise({ type: 'event' }, { id: 'sameId', delay: 100 }),
            on: {
              // event: { actions: fooSpy }
              event: (_, enq) => enq.action(fooSpy)
            }
          })
        },
        {
          id: 'bar',
          src: next_createMachine({
            id: 'bar',
            entry: (_, enq) =>
              enq.raise({ type: 'event' }, { id: 'sameId', delay: 100 }),
            on: {
              // event: { actions: barSpy },
              event: (_, enq) => enq.action(barSpy),
              // cancel: { actions: cancel('sameId') }
              cancel: (_, enq) => enq.cancel('sameId')
            }
          })
        }
      ],
      on: {
        // cancelBar: {
        //   actions: sendTo('bar', { type: 'cancel' })
        // }
        cancelBar: ({ children }) => {
          children['bar']?.send({ type: 'cancel' });
        }
      }
    });
    const actor = createActor(machine).start();

    await sleep(50);

    // This will cause the bar actor to cancel its 'sameId' delayed event
    // This should NOT cancel the 'sameId' delayed event in the other actor
    actor.send({ type: 'cancelBar' });

    await sleep(55);

    expect(fooSpy).toHaveBeenCalledTimes(1);
    expect(barSpy).not.toHaveBeenCalled();
  });

  it('should not try to clear an undefined timeout when canceling an unscheduled timer', async () => {
    const spy = jest.fn();

    const machine = next_createMachine({
      on: {
        // FOO: {
        //   actions: cancel('foo')
        // }
        FOO: (_, enq) => enq.cancel('foo')
      }
    });

    const actorRef = createActor(machine, {
      clock: {
        setTimeout,
        clearTimeout: spy
      }
    }).start();

    actorRef.send({
      type: 'FOO'
    });

    expect(spy.mock.calls.length).toBe(0);
  });

  it('should be able to cancel a just scheduled delayed event to a just invoked child', async () => {
    const spy = jest.fn();

    const child = next_createMachine({
      on: {
        // PING: {
        //   actions: spy
        // }
        PING: (_, enq) => enq.action(spy)
      }
    });

    const machine =
      // setup({
      //   actors: {
      //     child
      //   }
      // }).
      next_createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              START: 'b'
            }
          },
          b: {
            // entry: [
            //   sendTo('myChild', { type: 'PING' }, { id: 'myEvent', delay: 0 }),
            //   cancel('myEvent')
            // ],
            entry: ({ children }, enq) => {
              enq.sendTo(
                children.myChild,
                { type: 'PING' },
                { id: 'myEvent', delay: 0 }
              );
              enq.cancel('myEvent');
            },
            invoke: {
              src: child,
              id: 'myChild'
            }
          }
        }
      });

    const actorRef = createActor(machine).start();

    actorRef.send({
      type: 'START'
    });

    await sleep(10);
    expect(spy.mock.calls.length).toBe(0);
  });

  it('should not be able to cancel a just scheduled non-delayed event to a just invoked child', async () => {
    const spy = jest.fn();

    const child = next_createMachine({
      on: {
        // PING: {
        //   actions: spy
        // }
        PING: (_, enq) => enq.action(spy)
      }
    });

    const machine =
      // setup({
      //   actors: {
      //     child
      //   }
      // }).
      next_createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              START: 'b'
            }
          },
          b: {
            // entry: [
            //   sendTo('myChild', { type: 'PING' }, { id: 'myEvent' }),
            //   cancel('myEvent')
            // ],
            entry: ({ children }, enq) => {
              const myChild = enq.spawn(child, { id: 'myChild' });
              enq.sendTo(myChild, { type: 'PING' }, { id: 'myEvent' });
              // enq.cancel('myEvent');
            }
            // invoke: {
            //   src: child,
            //   id: 'myChild'
            // }
          }
        }
      });

    const actorRef = createActor(machine).start();

    actorRef.send({
      type: 'START'
    });

    expect(spy.mock.calls.length).toBe(1);
  });
});

describe('assign action order', () => {
  it('should preserve action order', () => {
    const captured: number[] = [];

    const machine = next_createMachine({
      // types: {} as {
      //   context: { count: number };
      // },
      context: { count: 0 },
      // entry: [
      //   ({ context }) => captured.push(context.count), // 0
      //   assign({ count: ({ context }) => context.count + 1 }),
      //   ({ context }) => captured.push(context.count), // 1
      //   assign({ count: ({ context }) => context.count + 1 }),
      //   ({ context }) => captured.push(context.count) // 2
      // ]
      entry: ({ context }, enq) => {
        const nextContext = { ...context };
        enq.action(captured.push, nextContext.count); // 0
        nextContext.count++;
        enq.action(captured.push, nextContext.count); // 1
        nextContext.count++;
        enq.action(captured.push, nextContext.count); // 2
        return { context: nextContext };
      }
    });

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().context).toEqual({ count: 2 });

    expect(captured).toEqual([0, 1, 2]);
  });

  it('should deeply preserve action order', () => {
    const captured: number[] = [];

    interface CountCtx {
      count: number;
    }

    const machine = next_createMachine(
      {
        // types: {} as {
        //   context: CountCtx;
        // },
        context: { count: 0 },
        // entry: [
        //   ({ context }) => captured.push(context.count), // 0
        //   enqueueActions(({ enqueue }) => {
        //     enqueue(assign({ count: ({ context }) => context.count + 1 }));
        //     enqueue({ type: 'capture' });
        //     enqueue(assign({ count: ({ context }) => context.count + 1 }));
        //   }),
        //   ({ context }) => captured.push(context.count) // 2
        // ]
        entry: ({ context }, enq) => {
          const newContext = { ...context };
          enq.action(captured.push, newContext.count);
          newContext.count++;
          newContext.count++;
          newContext.count++;
          enq.action(captured.push, newContext.count);
          return {
            context: newContext
          };
        }
      }
      // {
      //   actions: {
      //     capture: ({ context }) => captured.push(context.count)
      //   }
      // }
    );

    createActor(machine).start();

    expect(captured).toEqual([0, 1, 2]);
  });

  it('should capture correct context values on subsequent transitions', () => {
    let captured: number[] = [];

    const machine = next_createMachine({
      // types: {} as {
      //   context: { counter: number };
      // },
      context: {
        counter: 0
      },
      on: {
        // EV: {
        //   actions: [
        //     assign({ counter: ({ context }) => context.counter + 1 }),
        //     ({ context }) => captured.push(context.counter)
        //   ]
        // }
        EV: ({ context }, enq) => {
          const nextCount = context.counter + 1;
          enq.action(() => captured.push(nextCount));
          return { context: { counter: nextCount } };
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
  it.skip('assign actions should be inferred correctly', () => {
    // next_createMachine({
    //   types: {} as {
    //     context: { count: number; text: string };
    //     events: { type: 'inc'; value: number } | { type: 'say'; value: string };
    //   },
    //   context: {
    //     count: 0,
    //     text: 'hello'
    //   },
    //   entry: [
    //     assign({ count: 31 }),
    //     // @ts-expect-error
    //     assign({ count: 'string' }),
    //     assign({ count: () => 31 }),
    //     // @ts-expect-error
    //     assign({ count: () => 'string' }),
    //     assign({ count: ({ context }) => context.count + 31 }),
    //     // @ts-expect-error
    //     assign({ count: ({ context }) => context.text + 31 }),
    //     assign(() => ({ count: 31 })),
    //     // @ts-expect-error
    //     assign(() => ({ count: 'string' })),
    //     assign(({ context }) => ({ count: context.count + 31 })),
    //     // @ts-expect-error
    //     assign(({ context }) => ({ count: context.text + 31 }))
    //   ],
    //   on: {
    //     say: {
    //       actions: [
    //         assign({ text: ({ event }) => event.value }),
    //         // @ts-expect-error
    //         assign({ count: ({ event }) => event.value }),
    //         assign(({ event }) => ({ text: event.value })),
    //         // @ts-expect-error
    //         assign(({ event }) => ({ count: event.value }))
    //       ]
    //     }
    //   }
    // });
  });
});

describe('action meta', () => {
  it.todo(
    'base action objects should have meta.action as the same base action object'
  );

  it('should provide self', () => {
    expect.assertions(1);

    const machine = next_createMachine({
      entry: ({ self }, enq) => {
        enq.action(() => expect(self.send).toBeDefined());
      }
    });

    createActor(machine).start();
  });
});

describe('actions', () => {
  it('should call transition actions in document order for same-level parallel regions', () => {
    const actual: string[] = [];

    const machine = next_createMachine({
      type: 'parallel',
      states: {
        a: {
          on: {
            // FOO: {
            //   actions: () => actual.push('a')
            // }
            FOO: (_, enq) => enq.action(() => actual.push('a'))
          }
        },
        b: {
          on: {
            // FOO: {
            //   actions: () => actual.push('b')
            // }
            FOO: (_, enq) => enq.action(() => actual.push('b'))
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

    const machine = next_createMachine({
      type: 'parallel',
      states: {
        a: {
          initial: 'a1',
          states: {
            a1: {
              on: {
                // FOO: {
                //   actions: () => actual.push('a1')
                // }
                FOO: (_, enq) => enq.action(() => actual.push('a1'))
              }
            }
          }
        },
        b: {
          // on: {
          //   FOO: {
          //     actions: () => actual.push('b')
          //   }
          on: { FOO: (_, enq) => enq.action(() => actual.push('b')) }
        }
      }
    });
    const service = createActor(machine).start();
    service.send({ type: 'FOO' });

    expect(actual).toEqual(['a1', 'b']);
  });

  it('should call an inline action responding to an initial raise with the raised event', () => {
    const spy = jest.fn();

    const machine = next_createMachine({
      entry: (_, enq) => enq.raise({ type: 'HELLO' }),
      on: {
        // HELLO: {
        //   actions: ({ event }) => {
        //     spy(event);
        //   }
        // }
        HELLO: ({ event }, enq) => enq.action(spy, event)
      }
    });

    createActor(machine).start();

    expect(spy).toHaveBeenCalledWith({ type: 'HELLO' });
  });

  it('should call a referenced action responding to an initial raise with the raised event', () => {
    const spy = jest.fn();

    const machine = next_createMachine(
      {
        entry: (_, enq) => enq.raise({ type: 'HELLO' }),
        on: {
          // HELLO: {
          //   actions: 'foo'
          // }
          HELLO: ({ event }, enq) => {
            enq.action(spy, event);
          }
        }
      }
      // {
      //   actions: {
      //     foo: ({ event }) => {
      //       spy(event);
      //     }
      //   }
      // }
    );

    createActor(machine).start();

    expect(spy).toHaveBeenCalledWith({ type: 'HELLO' });
  });

  it('should call an inline action responding to an initial raise with updated (non-initial) context', () => {
    const spy = jest.fn();

    const machine = next_createMachine({
      context: { count: 0 },
      // entry: [assign({ count: 42 }), raise({ type: 'HELLO' })],
      entry: (_, enq) => {
        enq.raise({ type: 'HELLO' });
        return { context: { count: 42 } };
      },
      on: {
        // HELLO: {
        //   actions: ({ context }) => {
        //     spy(context);
        //   }
        // }
        HELLO: ({ context }, enq) => enq.action(spy, context)
      }
    });

    createActor(machine).start();

    expect(spy).toHaveBeenCalledWith({ count: 42 });
  });

  it('should call a referenced action responding to an initial raise with updated (non-initial) context', () => {
    const spy = jest.fn();

    const machine = next_createMachine(
      {
        context: { count: 0 },
        // entry: [assign({ count: 42 }), raise({ type: 'HELLO' })],
        entry: (_, enq) => {
          enq.raise({ type: 'HELLO' });
          return {
            context: { count: 42 }
          };
        },
        on: {
          // HELLO: {
          //   actions: 'foo'
          // }
          HELLO: ({ context }, enq) => enq.action(spy, context)
        }
      }
      // {
      //   actions: {
      //     foo: ({ context }) => {
      //       spy(context);
      //     }
      //   }
      // }
    );

    createActor(machine).start();

    expect(spy).toHaveBeenCalledWith({ count: 42 });
  });

  it.skip('should call inline entry custom action with undefined parametrized action object', () => {
    // const spy = jest.fn();
    // createActor(
    //   next_createMachine({
    //     entry: (_) => {
    //       spy();
    //     }
    //   })
    // ).start();
    // expect(spy).toHaveBeenCalledWith(undefined);
  });

  it.skip('should call inline entry builtin action with undefined parametrized action object', () => {
    // const spy = jest.fn();
    // createActor(
    //   next_createMachine({
    //     entry: assign((_, params) => {
    //       spy(params);
    //       return {};
    //     })
    //   })
    // ).start();
    // expect(spy).toHaveBeenCalledWith(undefined);
  });

  it.skip('should call inline transition custom action with undefined parametrized action object', () => {
    // const spy = jest.fn();
    // const actorRef = createActor(
    //   next_createMachine({
    //     on: {
    //       FOO: {
    //         actions: (_, params) => {
    //           spy(params);
    //         }
    //       }
    //     }
    //   })
    // ).start();
    // actorRef.send({ type: 'FOO' });
    // expect(spy).toHaveBeenCalledWith(undefined);
  });

  it.skip('should call inline transition builtin action with undefined parameters', () => {
    // const spy = jest.fn();
    // const actorRef = createActor(
    //   next_createMachine({
    //     on: {
    //       FOO: {
    //         actions: assign((_, params) => {
    //           spy(params);
    //           return {};
    //         })
    //       }
    //     }
    //   })
    // ).start();
    // actorRef.send({ type: 'FOO' });
    // expect(spy).toHaveBeenCalledWith(undefined);
  });

  it.skip('should call a referenced custom action with undefined params when it has no params and it is referenced using a string', () => {
    // const spy = jest.fn();
    // createActor(
    //   next_createMachine(
    //     {
    //       entry: 'myAction'
    //     },
    //     {
    //       actions: {
    //         myAction: (_, params) => {
    //           spy(params);
    //         }
    //       }
    //     }
    //   )
    // ).start();
    // expect(spy).toHaveBeenCalledWith(undefined);
  });

  it.skip('should call a referenced builtin action with undefined params when it has no params and it is referenced using a string', () => {
    // const spy = jest.fn();
    // createActor(
    //   next_createMachine(
    //     {
    //       entry: 'myAction'
    //     },
    //     {
    //       actions: {
    //         myAction: assign((_, params) => {
    //           spy(params);
    //           return {};
    //         })
    //       }
    //     }
    //   )
    // ).start();
    // expect(spy).toHaveBeenCalledWith(undefined);
  });

  it('should call a referenced custom action with the provided parametrized action object', () => {
    const spy = jest.fn();

    const myAction = (params: unknown) => spy(params);
    createActor(
      next_createMachine(
        {
          // entry: {
          //   type: 'myAction',
          //   params: {
          //     foo: 'bar'
          //   }
          // }
          entry: (_, enq) => {
            enq.action(myAction, { foo: 'bar' });
          }
        }
        // {
        //   actions: {
        //     myAction: (_, params) => {
        //       spy(params);
        //     }
        //   }
        // }
      )
    ).start();

    expect(spy).toHaveBeenCalledWith({
      foo: 'bar'
    });
  });

  it.skip('should call a referenced builtin action with the provided parametrized action object', () => {
    // const spy = jest.fn();
    // createActor(
    //   next_createMachine(
    //     {
    //       entry: {
    //         type: 'myAction',
    //         params: {
    //           foo: 'bar'
    //         }
    //       }
    //     },
    //     {
    //       actions: {
    //         myAction: assign((_, params) => {
    //           spy(params);
    //           return {};
    //         })
    //       }
    //     }
    //   )
    // ).start();
    // expect(spy).toHaveBeenCalledWith({
    //   foo: 'bar'
    // });
  });

  it.skip('should warn if called in custom action', () => {
    //     const machine = next_createMachine({
    //       entry: () => {
    //         assign({});
    //         raise({ type: '' });
    //         sendTo('', { type: '' });
    //         emit({ type: '' });
    //       }
    //     });
    //     createActor(machine).start();
    //     expect(console.warn).toMatchMockCallsInlineSnapshot(`
    // [
    //   [
    //     "Custom actions should not call \`assign()\` directly, as it is not imperative. See https://stately.ai/docs/actions#built-in-actions for more details.",
    //   ],
    //   [
    //     "Custom actions should not call \`raise()\` directly, as it is not imperative. See https://stately.ai/docs/actions#built-in-actions for more details.",
    //   ],
    //   [
    //     "Custom actions should not call \`sendTo()\` directly, as it is not imperative. See https://stately.ai/docs/actions#built-in-actions for more details.",
    //   ],
    //   [
    //     "Custom actions should not call \`emit()\` directly, as it is not imperative. See https://stately.ai/docs/actions#built-in-actions for more details.",
    //   ],
    // ]
    // `);
  });

  it.skip('inline actions should not leak into provided actions object', async () => {
    // const actions = {};
    // const machine = next_createMachine(
    //   {
    //     entry: () => {}
    //   },
    //   { actions }
    // );
    // createActor(machine).start();
    // expect(actions).toEqual({});
  });
});
