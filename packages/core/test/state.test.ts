import { next_createMachine, createActor } from '../src/index';
import { fromCallback } from '../src/actors/callback';
import { z } from 'zod';

const exampleMachine = next_createMachine({
  // types: {} as {
  //   events: Events;
  // },
  schemas: {
    events: z.union([
      z.object({ type: z.literal('BAR_EVENT') }),
      z.object({ type: z.literal('DEEP_EVENT') }),
      z.object({ type: z.literal('EXTERNAL') }),
      z.object({ type: z.literal('FOO_EVENT') }),
      z.object({ type: z.literal('FORBIDDEN_EVENT') }),
      z.object({ type: z.literal('INERT') }),
      z.object({ type: z.literal('INTERNAL') }),
      z.object({ type: z.literal('MACHINE_EVENT') }),
      z.object({ type: z.literal('P31') }),
      z.object({ type: z.literal('P32') }),
      z.object({ type: z.literal('THREE_EVENT') }),
      z.object({ type: z.literal('TO_THREE') }),
      z.object({ type: z.literal('TO_TWO'), foo: z.string() }),
      z.object({ type: z.literal('TO_TWO_MAYBE') }),
      z.object({ type: z.literal('TO_FINAL') })
    ])
  },
  initial: 'one',
  states: {
    one: {
      on: {
        EXTERNAL: {
          target: 'one',
          reenter: true
        },
        INERT: {},
        INTERNAL: {
          // actions: ['doSomething']
        },
        TO_TWO: 'two',
        TO_TWO_MAYBE: () => {
          if (true) {
            return { target: 'two' };
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const newAction = () => {};
      const machine = next_createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              NEXT: (_, enq) => {
                enq(newAction);
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
      const machine = next_createMachine({
        schemas: {
          context: z.object({
            count: z.number()
          })
        },
        initial: 'a',
        context: { count: 0 },
        states: {
          a: {
            on: {
              NEXT: () => {
                return {
                  context: {
                    count: 1
                  }
                };
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EV: (_, enq) => {
                enq(() => {});
                return { target: 'a' };
              }
            }
          }
        }
      });

      expect(createActor(machine).getSnapshot().can({ type: 'EV' })).toBe(true);
    });

    it('should return true for a targetless transition with actions', () => {
      const machine = next_createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EV: (_, enq) => {
                enq(() => {});
              }
            }
          }
        }
      });

      expect(createActor(machine).getSnapshot().can({ type: 'EV' })).toBe(true);
    });

    it('should return false for a forbidden transition', () => {
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              CHECK: () => {
                if (true) {
                  return { target: 'b' };
                }
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
      const machine = next_createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              CHECK: () => {
                if (1 + 1 !== 2) {
                  return { target: 'b' };
                }
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
      const machine = next_createMachine({
        schemas: {
          context: z.object({
            ref: z.any()
          })
        },
        context: {},
        initial: 'a',
        states: {
          a: {
            on: {
              SPAWN: (_, enq) => {
                return {
                  context: {
                    ref: enq.spawn(
                      fromCallback(() => {
                        spawned = true;
                      })
                    )
                  }
                };
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
      const machine = next_createMachine({
        context: {},
        on: {
          EVENT: (_, enq) => {
            enq(() => (executed = true));
          }
        }
      });

      const actorRef = createActor(machine);

      expect(actorRef.getSnapshot().can({ type: 'EVENT' })).toBeTruthy();

      expect(executed).toBeFalsy();
    });

    it('should not execute assignments when used with started actor', () => {
      let executed = false;
      const machine = next_createMachine({
        context: {},
        on: {
          EVENT: (_, enq) => {
            enq(() => (executed = true));
          }
        }
      });

      const actorRef = createActor(machine).start();

      expect(actorRef.getSnapshot().can({ type: 'EVENT' })).toBeTruthy();

      expect(executed).toBeFalsy();
    });

    it('should return true when non-first parallel region changes value', () => {
      const machine = next_createMachine({
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
      const machine = next_createMachine({
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
      const machine = next_createMachine({
        initial: 'a',
        states: {
          a: {
            tags: ['foo']
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
      const snapshot = createActor(next_createMachine({}))
        .start()
        .stop()
        .getSnapshot();
      expect(snapshot.status).toBe('stopped');
    });
  });
});
