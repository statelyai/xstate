import {
  createMachine,
  State,
  StateFrom,
  interpret,
  spawn
} from '../src/index';
import { initEvent } from '../src/actions';
import { assign } from '../src/actions/assign';
import { toSCXMLEvent } from '../src/utils';
import { createBehaviorFrom } from '../src/behaviors';

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
          internal: false
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
        guard: {
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
      expect(exampleMachine.initialState.changed).not.toBeDefined();
    });

    it('states from external transitions with entry actions should be changed', () => {
      const changedState = exampleMachine.transition(
        exampleMachine.initialState,
        'EXTERNAL'
      );
      expect(changedState.changed).toBe(true);
    });

    it('states from internal transitions with no actions should be unchanged', () => {
      const changedState = exampleMachine.transition(
        exampleMachine.initialState,
        'EXTERNAL'
      );
      const unchangedState = exampleMachine.transition(changedState, 'INERT');
      expect(unchangedState.changed).toBe(false);
    });

    it('states from internal transitions with actions should be changed', () => {
      const changedState = exampleMachine.transition(
        exampleMachine.initialState,
        'INTERNAL'
      );
      expect(changedState.changed).toBe(true);
    });

    it('normal state transitions should be changed (initial state)', () => {
      const changedState = exampleMachine.transition(
        exampleMachine.initialState,
        'TO_TWO'
      );
      expect(changedState.changed).toBe(true);
    });

    it('normal state transitions should be changed', () => {
      const twoState = exampleMachine.transition(
        exampleMachine.initialState,
        'TO_TWO'
      );
      const changedState = exampleMachine.transition(twoState, 'FOO_EVENT');
      expect(changedState.changed).toBe(true);
    });

    it('normal state transitions with unknown event should be unchanged', () => {
      const twoState = exampleMachine.transition(
        exampleMachine.initialState,
        'TO_TWO'
      );
      const changedState = exampleMachine.transition(
        twoState,
        'UNKNOWN_EVENT' as any
      );
      expect(changedState.changed).toBe(false);
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

      const twoState = finalMachine.transition('one', 'DONE');

      expect(twoState.changed).toBe(true);
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
                actions: assign({ count: (ctx) => ctx.count + 1 })
              }
            }
          }
        }
      });

      const { initialState } = assignMachine;
      const changedState = assignMachine.transition(initialState, 'EVENT');
      expect(changedState.changed).toBe(true);
      expect(initialState.value).toEqual(changedState.value);
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
                  value: (_, e) => {
                    return e.value;
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

      const nextState = toggleMachine.transition(toggleMachine.initialState, {
        type: 'CHANGE',
        value: 'whatever'
      });

      expect(nextState.changed).toBe(true);
      expect(nextState.value).toEqual({
        edit: {},
        validity: 'valid'
      });
    });
  });

  describe('.nextEvents', () => {
    it('returns the next possible events for the current state', () => {
      expect(exampleMachine.initialState.nextEvents.sort()).toEqual(
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

      expect(
        exampleMachine
          .transition(exampleMachine.initialState, 'TO_TWO')
          .nextEvents.sort()
      ).toEqual(['DEEP_EVENT', 'FOO_EVENT', 'MACHINE_EVENT']);

      expect(
        exampleMachine
          .transition(exampleMachine.initialState, 'TO_THREE')
          .nextEvents.sort()
      ).toEqual(['MACHINE_EVENT', 'P31', 'P32', 'THREE_EVENT']);
    });

    it('returns events when transitioned from StateValue', () => {
      const A = exampleMachine.transition(
        exampleMachine.initialState,
        'TO_THREE'
      );
      const B = exampleMachine.transition(A.value, 'TO_THREE');

      expect(B.nextEvents.sort()).toEqual([
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

      expect(noEventsMachine.initialState.nextEvents).toEqual([]);
    });
  });

  describe('State.create()', () => {
    it('should be able to create a state from a JSON config', () => {
      const { initialState } = exampleMachine;
      const jsonInitialState = JSON.parse(JSON.stringify(initialState));

      const stateFromConfig = State.create(jsonInitialState) as StateFrom<
        typeof exampleMachine
      >;

      expect(
        exampleMachine.transition(stateFromConfig, 'TO_TWO').value
      ).toEqual({
        two: { deep: 'foo' }
      });
    });

    it('should preserve state.nextEvents using machine.resolveState', () => {
      const { initialState } = exampleMachine;
      const { nextEvents } = initialState;
      const jsonInitialState = JSON.parse(JSON.stringify(initialState));

      const stateFromConfig = State.create(jsonInitialState) as StateFrom<
        typeof exampleMachine
      >;

      expect(
        exampleMachine.resolveState(stateFromConfig).nextEvents.sort()
      ).toEqual(nextEvents.sort());
    });
  });

  describe('State.inert()', () => {
    it('should create an inert instance of the given State', () => {
      const { initialState } = exampleMachine;

      expect(State.inert(initialState).actions).toEqual([]);
    });

    it('should create an inert instance of the given stateValue and context', () => {
      const { initialState } = exampleMachine;
      const inertState = State.inert(initialState.value, { foo: 'bar' });

      expect(inertState.actions).toEqual([]);
      expect(inertState.context).toEqual({ foo: 'bar' });
    });

    it('should preserve the given State if there are no actions', () => {
      const naturallyInertState = State.from('foo');

      expect(State.inert(naturallyInertState)).toEqual(naturallyInertState);
    });
  });

  describe('.event', () => {
    it('the .event prop should be the event (string) that caused the transition', () => {
      const { initialState } = exampleMachine;

      const nextState = exampleMachine.transition(initialState, 'TO_TWO');

      expect(nextState.event).toEqual({ type: 'TO_TWO' });
    });

    it('the .event prop should be the event (object) that caused the transition', () => {
      const { initialState } = exampleMachine;

      const nextState = exampleMachine.transition(initialState, {
        type: 'TO_TWO',
        foo: 'bar'
      });

      expect(nextState.event).toEqual({ type: 'TO_TWO', foo: 'bar' });
    });

    it('the ._event prop should be the initial event for the initial state', () => {
      const { initialState } = exampleMachine;

      expect(initialState._event).toEqual(initEvent);
    });
  });

  describe('._event', () => {
    it('the ._event prop should be the SCXML event (string) that caused the transition', () => {
      const { initialState } = exampleMachine;

      const nextState = exampleMachine.transition(initialState, 'TO_TWO');

      expect(nextState._event).toEqual(toSCXMLEvent('TO_TWO'));
    });

    it('the ._event prop should be the SCXML event (object) that caused the transition', () => {
      const { initialState } = exampleMachine;

      const nextState = exampleMachine.transition(initialState, {
        type: 'TO_TWO',
        foo: 'bar'
      });

      expect(nextState._event).toEqual(
        toSCXMLEvent({ type: 'TO_TWO', foo: 'bar' })
      );
    });

    it('the ._event prop should be the initial SCXML event for the initial state', () => {
      const { initialState } = exampleMachine;

      expect(initialState._event).toEqual(toSCXMLEvent(initEvent));
    });

    it('the ._event prop should be the SCXML event (SCXML metadata) that caused the transition', () => {
      const { initialState } = exampleMachine;

      const nextState = exampleMachine.transition(
        initialState,
        toSCXMLEvent(
          {
            type: 'TO_TWO',
            foo: 'bar'
          },
          {
            sendid: 'test'
          }
        )
      );

      expect(nextState._event).toEqual(
        toSCXMLEvent(
          { type: 'TO_TWO', foo: 'bar' },
          {
            sendid: 'test'
          }
        )
      );
    });

    describe('_sessionid', () => {
      it('_sessionid should be null for non-invoked machines', () => {
        const testMachine = createMachine({
          initial: 'active',
          states: {
            active: {}
          }
        });

        expect(testMachine.initialState._sessionid).toBeNull();
      });

      it('_sessionid should be the service sessionId for invoked machines', (done) => {
        const testMachine = createMachine({
          initial: 'active',
          states: {
            active: {
              on: {
                TOGGLE: 'inactive'
              }
            },
            inactive: {
              type: 'final'
            }
          }
        });

        const service = interpret(testMachine);

        service
          .onTransition((state) => {
            expect(state._sessionid).toEqual(service.sessionId);
          })
          .onDone(() => {
            done();
          })
          .start();

        service.send('TOGGLE');
      });

      it('_sessionid should persist through states (manual)', () => {
        const testMachine = createMachine({
          initial: 'active',
          states: {
            active: {
              on: {
                TOGGLE: 'inactive'
              }
            },
            inactive: {
              type: 'final'
            }
          }
        });

        const { initialState } = testMachine;

        initialState._sessionid = 'somesessionid';

        const nextState = testMachine.transition(initialState, 'TOGGLE');

        expect(nextState._sessionid).toEqual('somesessionid');
      });
    });
  });

  describe('.transitions', () => {
    const { initialState } = exampleMachine;

    it('should have no transitions for the initial state', () => {
      expect(initialState.transitions).toHaveLength(0);
    });

    it('should have transitions for the sent event', () => {
      expect(
        exampleMachine.transition(initialState, 'TO_TWO').transitions
      ).toContainEqual(expect.objectContaining({ eventType: 'TO_TWO' }));
    });

    it('should have condition in the transition', () => {
      expect(
        exampleMachine.transition(initialState, 'TO_TWO_MAYBE').transitions
      ).toContainEqual(
        expect.objectContaining({
          eventType: 'TO_TWO_MAYBE',
          guard: expect.objectContaining({ type: 'maybe' })
        })
      );
    });
  });

  describe('State.prototype.matches', () => {
    it('should keep reference to state instance after destructuring', () => {
      const { initialState } = exampleMachine;
      const { matches } = initialState;

      expect(matches('one')).toBe(true);
    });
  });

  describe('State.prototype.toStrings', () => {
    it('should return all state paths as strings', () => {
      const twoState = exampleMachine.transition('one', 'TO_TWO');

      expect(twoState.toStrings()).toEqual(['two', 'two.deep', 'two.deep.foo']);
    });

    it('should respect `delimiter` option for deeply nested states', () => {
      const twoState = exampleMachine.transition('one', 'TO_TWO');

      expect(twoState.toStrings(undefined, ':')).toEqual([
        'two',
        'two:deep',
        'two:deep:foo'
      ]);
    });

    it('should keep reference to state instance after destructuring', () => {
      const { initialState } = exampleMachine;
      const { toStrings } = initialState;

      expect(toStrings()).toEqual(['one']);
    });
  });

  describe('.done', () => {
    it('should show that a machine has not reached its final state', () => {
      expect(exampleMachine.initialState.done).toBeFalsy();
    });

    it('should show that a machine has reached its final state', () => {
      expect(
        exampleMachine.transition(undefined, 'TO_FINAL').done
      ).toBeTruthy();
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

      expect(machine.initialState.can('NEXT')).toBe(true);
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

      expect(machine.initialState.can({ type: 'NEXT' })).toBe(true);
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

      expect(machine.initialState.can({ type: 'NEXT' })).toBe(true);
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

      expect(machine.initialState.can({ type: 'NEXT' })).toBe(true);
    });

    it('should return false for an external self-transition without actions', () => {
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

      expect(machine.initialState.can({ type: 'EV' })).toBe(false);
    });

    it('should return true for an external self-transition with reentry action', () => {
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

      expect(machine.initialState.can({ type: 'EV' })).toBe(true);
    });

    it('should return true for an external self-transition with transition action', () => {
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

      expect(machine.initialState.can({ type: 'EV' })).toBe(true);
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

      expect(machine.initialState.can({ type: 'EV' })).toBe(true);
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

      expect(machine.initialState.can({ type: 'EV' })).toBe(false);
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

      expect(machine.initialState.can({ type: 'UNKNOWN' })).toBe(false);
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
        machine.initialState.can({
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
        machine.initialState.can({
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
                actions: assign(() => ({
                  ref: spawn(
                    createBehaviorFrom(() => {
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
      service.state.can('SPAWN');
      expect(spawned).toBe(false);
    });

    it('should return false for states created without a machine', () => {
      const state = State.from('test');

      expect(state.can({ type: 'ANY_EVENT' })).toEqual(false);
    });

    it('should allow errors to propagate', () => {
      const machine = createMachine({
        context: {},
        on: {
          DO_SOMETHING_BAD: {
            actions: assign(() => {
              throw new Error('expected error');
            })
          }
        }
      });

      console.log(machine.initialState.context);

      expect(() => {
        const { initialState } = machine;

        initialState.can('DO_SOMETHING_BAD');
      }).toThrowError(/expected error/);
    });
  });
});
