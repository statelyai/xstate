import { createMachine, createActor } from '../src/index';
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

const exampleMachine = createMachine({
  types: {} as {
    events: Events;
  },
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
  describe('status', () => {
    it('should show that a machine has not reached its final state', () => {
      expect(createActor(exampleMachine).getSnapshot().status).not.toBe('done');
    });

    it('should show that a machine has reached its final state', () => {
      const actorRef = createActor(exampleMachine).start();
      actorRef.send({ type: 'TO_FINAL' });
      expect(actorRef.getSnapshot().status).toBe('done');
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

      expect(createActor(machine).getSnapshot().can({ type: 'NEXT' })).toBe(
        true
      );
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

      expect(createActor(machine).getSnapshot().can({ type: 'NEXT' })).toBe(
        true
      );
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

      expect(createActor(machine).getSnapshot().can({ type: 'NEXT' })).toBe(
        true
      );
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

      expect(createActor(machine).getSnapshot().can({ type: 'NEXT' })).toBe(
        true
      );
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

      expect(createActor(machine).getSnapshot().can({ type: 'EV' })).toBe(true);
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

      expect(createActor(machine).getSnapshot().can({ type: 'EV' })).toBe(true);
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

      expect(createActor(machine).getSnapshot().can({ type: 'EV' })).toBe(true);
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

      expect(createActor(machine).getSnapshot().can({ type: 'EV' })).toBe(true);
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

      expect(createActor(machine).getSnapshot().can({ type: 'EV' })).toBe(
        false
      );
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

      expect(createActor(machine).getSnapshot().can({ type: 'UNKNOWN' })).toBe(
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
        createActor(machine).getSnapshot().can({
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
        createActor(machine).getSnapshot().can({
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

      const service = createActor(machine).start();
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

      const actorRef = createActor(machine);

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

      const actorRef = createActor(machine).start();

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
        createActor(machine).getSnapshot().can({ type: 'EVENT' })
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

      const actorRef = createActor(machine).start();
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

      const actorRef = createActor(machine).start();
      const persistedState = actorRef.getPersistedSnapshot();
      actorRef.stop();
      const restoredSnapshot = createActor(machine, {
        snapshot: persistedState
      }).getSnapshot();

      expect(restoredSnapshot.hasTag('foo')).toBe(true);
    });
  });

  describe('.status', () => {
    it("should be 'stopped' after a running actor gets stopped", () => {
      const snapshot = createActor(createMachine({}))
        .start()
        .stop()
        .getSnapshot();
      expect(snapshot.status).toBe('stopped');
    });
  });

  describe('.event', () => {
    it('should have init event on initial snapshot', () => {
      const machine = createMachine({
        initial: 'a',
        states: { a: {} }
      });

      const actor = createActor(machine).start();
      expect(actor.getSnapshot().event.type).toBe('xstate.init');
    });

    it('should have init event with input on initial snapshot', () => {
      const machine = createMachine({
        types: {} as { input: { value: number } },
        context: ({ input }) => ({ value: input.value }),
        initial: 'a',
        states: { a: {} }
      });

      const actor = createActor(machine, { input: { value: 42 } }).start();
      expect(actor.getSnapshot().event.type).toBe('xstate.init');
      expect((actor.getSnapshot().event as any).input).toEqual({ value: 42 });
    });

    it('should have the triggering event on snapshot after transition', () => {
      const machine = createMachine({
        types: {} as { events: { type: 'EVENT'; data: number } },
        initial: 'a',
        states: {
          a: { on: { EVENT: 'b' } },
          b: {}
        }
      });

      const actor = createActor(machine).start();
      actor.send({ type: 'EVENT', data: 123 });

      expect(actor.getSnapshot().event).toEqual({ type: 'EVENT', data: 123 });
    });

    it('should update event on each transition', () => {
      const machine = createMachine({
        types: {} as {
          events: { type: 'FIRST' } | { type: 'SECOND'; value: string };
        },
        initial: 'a',
        states: {
          a: { on: { FIRST: 'b' } },
          b: { on: { SECOND: 'c' } },
          c: {}
        }
      });

      const actor = createActor(machine).start();

      actor.send({ type: 'FIRST' });
      expect(actor.getSnapshot().event).toEqual({ type: 'FIRST' });

      actor.send({ type: 'SECOND', value: 'test' });
      expect(actor.getSnapshot().event).toEqual({
        type: 'SECOND',
        value: 'test'
      });
    });

    it('should preserve event on eventless (always) transitions', () => {
      const machine = createMachine({
        types: {} as { events: { type: 'TRIGGER'; data: number } },
        initial: 'a',
        states: {
          a: { on: { TRIGGER: 'b' } },
          b: { always: 'c' },
          c: {}
        }
      });

      const actor = createActor(machine).start();
      actor.send({ type: 'TRIGGER', data: 42 });

      // After the eventless transition from b -> c, the event should still be TRIGGER
      expect(actor.getSnapshot().value).toBe('c');
      expect(actor.getSnapshot().event).toEqual({ type: 'TRIGGER', data: 42 });
    });

    it('should be included in persisted snapshot', () => {
      const machine = createMachine({
        types: {} as { events: { type: 'EVENT'; payload: string } },
        initial: 'a',
        states: {
          a: { on: { EVENT: 'b' } },
          b: {}
        }
      });

      const actor = createActor(machine).start();
      actor.send({ type: 'EVENT', payload: 'test' });

      const persisted = actor.getPersistedSnapshot();
      expect((persisted as any).event).toEqual({
        type: 'EVENT',
        payload: 'test'
      });
    });

    it('should be restored from persisted snapshot', () => {
      const machine = createMachine({
        types: {} as { events: { type: 'EVENT'; payload: string } },
        initial: 'a',
        states: {
          a: { on: { EVENT: 'b' } },
          b: {}
        }
      });

      const actor1 = createActor(machine).start();
      actor1.send({ type: 'EVENT', payload: 'test' });
      const persisted = actor1.getPersistedSnapshot();
      actor1.stop();

      const actor2 = createActor(machine, { snapshot: persisted }).start();
      expect(actor2.getSnapshot().event).toEqual({
        type: 'EVENT',
        payload: 'test'
      });
    });

    it('should use structural sharing for deeply equal events', () => {
      const machine = createMachine({
        types: {} as {
          events: { type: 'EVENT'; nested: { value: number; items: string[] } };
        },
        initial: 'a',
        states: { a: {} }
      });

      const actor = createActor(machine).start();

      // First event with nested structure
      actor.send({
        type: 'EVENT',
        nested: { value: 42, items: ['a', 'b'] }
      });
      const snapshot1 = actor.getSnapshot();

      // Second event with deeply equal structure (but new objects)
      actor.send({
        type: 'EVENT',
        nested: { value: 42, items: ['a', 'b'] }
      });
      const snapshot2 = actor.getSnapshot();

      // Structural sharing should preserve the original event reference
      expect(snapshot2.event).toBe(snapshot1.event);
      expect(snapshot2).toBe(snapshot1);
    });

    it('should create new snapshot when event has different nested values', () => {
      const machine = createMachine({
        types: {} as {
          events: { type: 'EVENT'; data: { count: number } };
        },
        initial: 'a',
        states: { a: {} }
      });

      const actor = createActor(machine).start();

      actor.send({ type: 'EVENT', data: { count: 1 } });
      const snapshot1 = actor.getSnapshot();

      actor.send({ type: 'EVENT', data: { count: 2 } });
      const snapshot2 = actor.getSnapshot();

      // Different nested value means different event
      expect(snapshot2.event).not.toBe(snapshot1.event);
      expect(snapshot2).not.toBe(snapshot1);
      expect(snapshot2.event).toEqual({ type: 'EVENT', data: { count: 2 } });
    });
  });
});
