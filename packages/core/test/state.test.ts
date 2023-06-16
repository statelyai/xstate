import { createMachine, interpret } from '../src/index';
import { assign } from '../src/actions/assign';
import { fromCallback } from '../src/actors/callback';

type Events =
  | { type: 'BAR_EVENT' }
  | { type: 'DEEP_EVENT' }
  | { type: 'EXTERNAL' }
  | { type: 'FOO_EVENT' }
  | { type: 'FORBIDDEN_EVENT' }
  | { type: 'INERT' }
  | { type: 'INTERNAL' }
  | { type: 'MACHINE_EVENT' }
  | { type: 'P31' }
  | { type: 'P32' }
  | { type: 'THREE_EVENT' }
  | { type: 'TO_THREE' }
  | { type: 'TO_TWO'; foo: string }
  | { type: 'TO_TWO_MAYBE' }
  | { type: 'TO_FINAL' };

const exampleMachine = createMachine<any, Events>({
  initial: 'one',
  states: {
    one: {
      entry: ['enter'],
      on: {
        EXTERNAL: {
          target: 'one',
          reenter: true
        },
        INERT: {},
        INTERNAL: {
          actions: ['doSomething']
        },
        TO_TWO: 'two',
        TO_TWO_MAYBE: {
          target: 'two',
          guard: function maybe() {
            return true;
          }
        },
        TO_THREE: 'three',
        FORBIDDEN_EVENT: undefined,
        TO_FINAL: 'success'
      }
    },
    two: {
      initial: 'deep',
      states: {
        deep: {
          initial: 'foo',
          states: {
            foo: {
              on: {
                FOO_EVENT: 'bar',
                FORBIDDEN_EVENT: undefined
              }
            },
            bar: {
              on: {
                BAR_EVENT: 'foo'
              }
            }
          }
        }
      },
      on: {
        DEEP_EVENT: '.'
      }
    },
    three: {
      type: 'parallel',
      states: {
        first: {
          initial: 'p31',
          states: {
            p31: {
              on: { P31: '.' }
            }
          }
        },
        guarded: {
          initial: 'p32',
          states: {
            p32: {
              on: { P32: '.' }
            }
          }
        }
      },
      on: {
        THREE_EVENT: '.'
      }
    },
    success: {
      type: 'final'
    }
  },
  on: {
    MACHINE_EVENT: '.two'
  }
});

describe('State', () => {
  describe('.changed', () => {
    it('should indicate that it is not changed if initial state', () => {
      const actorRef = interpret(exampleMachine);
      expect(actorRef.getSnapshot().changed).not.toBeDefined();
    });

    it('states from reentering transitions with entry actions should be changed', () => {
      const actorRef = interpret(exampleMachine).start();
      actorRef.send({ type: 'EXTERNAL' });
      expect(actorRef.getSnapshot().changed).toBe(true);
    });

    it('states from internal transitions with no actions should be unchanged', () => {
      const actorRef = interpret(exampleMachine).start();
      actorRef.send({ type: 'EXTERNAL' });
      actorRef.send({ type: 'INERT' });
      expect(actorRef.getSnapshot().changed).toBe(false);
    });

    it('states from internal transitions with actions should be changed', () => {
      const actorRef = interpret(exampleMachine).start();
      actorRef.send({ type: 'INTERNAL' });
      expect(actorRef.getSnapshot().changed).toBe(true);
    });

    it('normal state transitions should be changed (initial state)', () => {
      const actorRef = interpret(exampleMachine).start();
      actorRef.send({ type: 'TO_TWO', foo: 'test' });
      expect(actorRef.getSnapshot().changed).toBe(true);
    });

    it('normal state transitions should be changed', () => {
      const actorRef = interpret(exampleMachine).start();
      actorRef.send({
        type: 'TO_TWO',
        foo: 'test'
      });
      actorRef.send({
        type: 'FOO_EVENT'
      });
      expect(actorRef.getSnapshot().changed).toBe(true);
    });

    it('normal state transitions with unknown event should be unchanged', () => {
      const actorRef = interpret(exampleMachine).start();
      actorRef.send({
        type: 'TO_TWO',
        foo: 'test'
      });
      actorRef.send({
        // @ts-expect-error
        type: 'UNKNOWN_EVENT'
      });
      expect(actorRef.getSnapshot().changed).toBe(false);
    });

    it('should report entering a final state as changed', () => {
      const finalMachine = createMachine({
        id: 'final',
        initial: 'one',
        states: {
          one: {
            on: {
              DONE: 'two'
            }
          },

          two: {
            type: 'final'
          }
        }
      });

      const actorRef = interpret(finalMachine).start();
      actorRef.send({ type: 'DONE' });

      expect(actorRef.getSnapshot().changed).toBe(true);
    });

    it('should report any internal transition assignments as changed', () => {
      const assignMachine = createMachine<{ count: number }>({
        id: 'assign',
        initial: 'same',
        context: {
          count: 0
        },
        states: {
          same: {
            on: {
              EVENT: {
                actions: assign({ count: ({ context }) => context.count + 1 })
              }
            }
          }
        }
      });

      const actorRef = interpret(assignMachine);
      const initialSnapshot = actorRef.getSnapshot();
      actorRef.start();
      actorRef.send({
        type: 'EVENT'
      });
      const snapshot = actorRef.getSnapshot();
      expect(snapshot.changed).toBe(true);
      expect(initialSnapshot.value).toEqual(snapshot.value);
    });

    it('should not escape targetless child state nodes', () => {
      interface Ctx {
        value: string;
      }
      type ToggleEvents =
        | {
            type: 'CHANGE';
            value: string;
          }
        | {
            type: 'SAVE';
          };
      const toggleMachine = createMachine<Ctx, ToggleEvents>({
        id: 'input',
        context: {
          value: ''
        },
        type: 'parallel',
        states: {
          edit: {
            on: {
              CHANGE: {
                actions: assign({
                  value: ({ event }) => {
                    return event.value;
                  }
                })
              }
            }
          },
          validity: {
            initial: 'invalid',
            states: {
              invalid: {},
              valid: {}
            },
            on: {
              CHANGE: [
                {
                  target: '.valid',
                  guard: () => true
                },
                {
                  target: '.invalid'
                }
              ]
            }
          }
        }
      });

      const actorRef = interpret(toggleMachine).start();
      actorRef.send({
        type: 'CHANGE',
        value: 'whatever'
      });

      const snapshot = actorRef.getSnapshot();

      expect(snapshot.changed).toBe(true);
      expect(snapshot.value).toEqual({
        edit: {},
        validity: 'valid'
      });
    });
  });

  describe('.nextEvents', () => {
    it('returns the next possible events for the current state', () => {
      const actorRef = interpret(exampleMachine);

      expect(actorRef.getSnapshot().nextEvents.sort()).toEqual(
        [
          'EXTERNAL',
          'INTERNAL',
          'MACHINE_EVENT',
          'TO_FINAL',
          'TO_THREE',
          'TO_TWO',
          'TO_TWO_MAYBE'
        ].sort()
      );

      actorRef.start();
      actorRef.send({
        type: 'TO_TWO',
        foo: 'test'
      });

      expect(actorRef.getSnapshot().nextEvents.sort()).toEqual([
        'DEEP_EVENT',
        'FOO_EVENT',
        'MACHINE_EVENT'
      ]);

      const actorRef2 = interpret(exampleMachine).start();
      actorRef2.send({ type: 'TO_THREE' });

      expect(actorRef2.getSnapshot().nextEvents.sort()).toEqual([
        'MACHINE_EVENT',
        'P31',
        'P32',
        'THREE_EVENT'
      ]);
    });

    it('returns events when transitioned from StateValue', () => {
      const actorRef = interpret(exampleMachine).start();

      actorRef.send({
        type: 'TO_THREE'
      });
      actorRef.send({ type: 'TO_THREE' });

      expect(actorRef.getSnapshot().nextEvents.sort()).toEqual([
        'MACHINE_EVENT',
        'P31',
        'P32',
        'THREE_EVENT'
      ]);
    });

    it('returns no next events if there are none', () => {
      const noEventsMachine = createMachine({
        id: 'no-events',
        initial: 'idle',
        states: {
          idle: {
            on: {}
          }
        }
      });

      expect(interpret(noEventsMachine).getSnapshot().nextEvents).toEqual([]);
    });
  });

  describe('machine.createState()', () => {
    it('should be able to create a state from a JSON config', () => {
      const initialState = interpret(exampleMachine).getSnapshot();
      const jsonInitialState = JSON.parse(JSON.stringify(initialState));

      const stateFromConfig = exampleMachine.createState(jsonInitialState);

      const actorRef = interpret(exampleMachine, {
        state: stateFromConfig
      }).start();

      actorRef.send({
        type: 'TO_TWO',
        foo: 'test'
      });

      expect(actorRef.getSnapshot().value).toEqual({
        two: { deep: 'foo' }
      });
    });

    it('should preserve state.nextEvents using machine.resolveState', () => {
      const actorRef = interpret(exampleMachine);
      const initialState = actorRef.getSnapshot();
      const { nextEvents } = initialState;
      const jsonInitialState = JSON.parse(JSON.stringify(initialState));

      const stateFromConfig = exampleMachine.createState(jsonInitialState);

      expect(
        exampleMachine.resolveState(stateFromConfig).nextEvents.sort()
      ).toEqual(nextEvents.sort());
    });
  });

  describe('State.prototype.matches', () => {
    it('should keep reference to state instance after destructuring', () => {
      const { matches } = interpret(exampleMachine).getSnapshot();

      expect(matches('one')).toBe(true);
    });
  });

  describe('State.prototype.toStrings', () => {
    it('should return all state paths as strings', () => {
      const actorRef = interpret(exampleMachine).start();
      actorRef.send({
        type: 'TO_TWO',
        foo: 'test'
      });

      expect(actorRef.getSnapshot().toStrings()).toEqual([
        'two',
        'two.deep',
        'two.deep.foo'
      ]);
    });

    it('should respect `delimiter` option for deeply nested states', () => {
      const actorRef = interpret(exampleMachine).start();
      actorRef.send({
        type: 'TO_TWO',
        foo: 'test'
      });

      expect(actorRef.getSnapshot().toStrings(undefined, ':')).toEqual([
        'two',
        'two:deep',
        'two:deep:foo'
      ]);
    });

    it('should keep reference to state instance after destructuring', () => {
      expect(interpret(exampleMachine).getSnapshot().toStrings()).toEqual([
        'one'
      ]);
    });
  });

  describe('.done', () => {
    it('should show that a machine has not reached its final state', () => {
      expect(interpret(exampleMachine).getSnapshot().done).toBeFalsy();
    });

    it('should show that a machine has reached its final state', () => {
      const actorRef = interpret(exampleMachine).start();
      actorRef.send({ type: 'TO_FINAL' });
      expect(actorRef.getSnapshot().done).toBeTruthy();
    });
  });

  describe('.can', () => {
    it('should return true for a simple event that results in a transition to a different state', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              NEXT: 'b'
            }
          },
          b: {}
        }
      });

      expect(interpret(machine).getSnapshot().can({ type: 'NEXT' })).toBe(true);
    });

    it('should return true for an event object that results in a transition to a different state', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              NEXT: 'b'
            }
          },
          b: {}
        }
      });

      expect(interpret(machine).getSnapshot().can({ type: 'NEXT' })).toBe(true);
    });

    it('should return true for an event object that results in a new action', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              NEXT: {
                actions: 'newAction'
              }
            }
          }
        }
      });

      expect(interpret(machine).getSnapshot().can({ type: 'NEXT' })).toBe(true);
    });

    it('should return true for an event object that results in a context change', () => {
      const machine = createMachine({
        initial: 'a',
        context: { count: 0 },
        states: {
          a: {
            on: {
              NEXT: {
                actions: assign({ count: 1 })
              }
            }
          }
        }
      });

      expect(interpret(machine).getSnapshot().can({ type: 'NEXT' })).toBe(true);
    });

    it('should return true for a reentering self-transition without actions', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EV: 'a'
            }
          }
        }
      });

      expect(interpret(machine).getSnapshot().can({ type: 'EV' })).toBe(true);
    });

    it('should return true for a reentering self-transition with reentry action', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            entry: () => {},
            on: {
              EV: 'a'
            }
          }
        }
      });

      expect(interpret(machine).getSnapshot().can({ type: 'EV' })).toBe(true);
    });

    it('should return true for a reentering self-transition with transition action', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EV: {
                target: 'a',
                actions: () => {}
              }
            }
          }
        }
      });

      expect(interpret(machine).getSnapshot().can({ type: 'EV' })).toBe(true);
    });

    it('should return true for a targetless transition with actions', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EV: {
                actions: () => {}
              }
            }
          }
        }
      });

      expect(interpret(machine).getSnapshot().can({ type: 'EV' })).toBe(true);
    });

    it('should return false for a forbidden transition', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EV: undefined
            }
          }
        }
      });

      expect(interpret(machine).getSnapshot().can({ type: 'EV' })).toBe(false);
    });

    it('should return false for an unknown event', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              NEXT: 'b'
            }
          },
          b: {}
        }
      });

      expect(interpret(machine).getSnapshot().can({ type: 'UNKNOWN' })).toBe(
        false
      );
    });

    it('should return true when a guarded transition allows the transition', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              CHECK: {
                target: 'b',
                guard: () => true
              }
            }
          },
          b: {}
        }
      });

      expect(
        interpret(machine).getSnapshot().can({
          type: 'CHECK'
        })
      ).toBe(true);
    });

    it('should return false when a guarded transition disallows the transition', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              CHECK: {
                target: 'b',
                guard: () => false
              }
            }
          },
          b: {}
        }
      });

      expect(
        interpret(machine).getSnapshot().can({
          type: 'CHECK'
        })
      ).toBe(false);
    });

    it('should not spawn actors when determining if an event is accepted', () => {
      let spawned = false;
      const machine = createMachine({
        context: {},
        initial: 'a',
        states: {
          a: {
            on: {
              SPAWN: {
                actions: assign(({ spawn }) => ({
                  ref: spawn(
                    fromCallback(() => {
                      spawned = true;
                    })
                  )
                }))
              }
            }
          },
          b: {}
        }
      });

      const service = interpret(machine).start();
      service.getSnapshot().can({ type: 'SPAWN' });
      expect(spawned).toBe(false);
    });

    it('should not execute assignments when used with non-started actor', () => {
      let executed = false;
      const machine = createMachine({
        context: {},
        on: {
          EVENT: {
            actions: assign((ctx) => {
              // Side-effect just for testing
              executed = true;
              return ctx;
            })
          }
        }
      });

      const actorRef = interpret(machine);

      expect(actorRef.getSnapshot().can({ type: 'EVENT' })).toBeTruthy();

      expect(executed).toBeFalsy();
    });

    it('should not execute assignments when used with started actor', () => {
      let executed = false;
      const machine = createMachine({
        context: {},
        on: {
          EVENT: {
            actions: assign((ctx) => {
              // Side-effect just for testing
              executed = true;
              return ctx;
            })
          }
        }
      });

      const actorRef = interpret(machine).start();

      expect(actorRef.getSnapshot().can({ type: 'EVENT' })).toBeTruthy();

      expect(executed).toBeFalsy();
    });

    it('should return true when non-first parallel region changes value', () => {
      const machine = createMachine({
        type: 'parallel',
        states: {
          a: {
            initial: 'a1',
            states: {
              a1: {
                id: 'foo',
                on: {
                  // first region doesn't change value here
                  EVENT: { target: ['#foo', '#bar'] }
                }
              }
            }
          },
          b: {
            initial: 'b1',
            states: {
              b1: {},
              b2: {
                id: 'bar'
              }
            }
          }
        }
      });

      expect(
        interpret(machine).getSnapshot().can({ type: 'EVENT' })
      ).toBeTruthy();
    });

    it('should return true when transition targets a state that is already part of the current configuration but the final state value changes', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            id: 'foo',
            initial: 'a1',
            states: {
              a1: {
                on: {
                  NEXT: 'a2'
                }
              },
              a2: {
                on: {
                  NEXT: '#foo'
                }
              }
            }
          }
        }
      });

      const actorRef = interpret(machine).start();
      actorRef.send({ type: 'NEXT' });

      expect(actorRef.getSnapshot().can({ type: 'NEXT' })).toBeTruthy();
    });
  });

  describe('.hasTag', () => {
    it('should be able to check a tag after recreating a persisted state', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            tags: 'foo'
          }
        }
      });

      const actorRef = interpret(machine).start();
      const persistedState = JSON.stringify(actorRef.getPersistedState());
      actorRef.stop();
      const restoredState = machine.createState(JSON.parse(persistedState));

      expect(restoredState.hasTag('foo')).toBe(true);
    });
  });
});
