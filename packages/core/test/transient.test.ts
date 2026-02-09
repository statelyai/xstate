import { z } from 'zod';
import { createMachine, createActor, matchesState } from '../src/index';

const greetingContext = { hour: 10 };
const greetingMachine = createMachine({
  // types: {} as { context: typeof greetingContext },
  schemas: {
    context: z.object({
      hour: z.number()
    })
  },
  id: 'greeting',
  initial: 'pending',
  context: greetingContext,
  states: {
    pending: {
      always: ({ context }) => {
        if (context.hour < 12) {
          return { target: 'morning' };
        } else if (context.hour < 18) {
          return { target: 'afternoon' };
        } else {
          return { target: 'evening' };
        }
      }
    },
    morning: {},
    afternoon: {},
    evening: {}
  },
  on: {
    CHANGE: () => ({
      context: {
        hour: 20
      }
    }),
    RECHECK: '#greeting'
  }
});

describe('transient states (eventless transitions)', () => {
  it('should choose the first candidate target that matches the guard 1', () => {
    const machine = createMachine({
      // types: {} as { context: { data: boolean } },
      schemas: {
        context: z.object({
          data: z.boolean()
        })
      },
      context: { data: false },
      initial: 'G',
      states: {
        G: {
          on: { UPDATE_BUTTON_CLICKED: 'E' }
        },
        E: {
          always: ({ context }) => {
            if (!context.data) {
              return { target: 'D' };
            } else {
              return { target: 'F' };
            }
          }
        },
        D: {},
        F: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'UPDATE_BUTTON_CLICKED' });

    expect(actorRef.getSnapshot().value).toEqual('D');
  });

  it('should choose the first candidate target that matches the guard 2', () => {
    const machine = createMachine({
      // types: {} as { context: { data: boolean; status?: string } },
      schemas: {
        context: z.object({
          data: z.boolean(),
          status: z.string().optional()
        })
      },
      context: { data: false },
      initial: 'G',
      states: {
        G: {
          on: { UPDATE_BUTTON_CLICKED: 'E' }
        },
        E: {
          always: ({ context }) => {
            if (!context.data) {
              return { target: 'D' };
            } else {
              return { target: 'F' };
            }
          }
        },
        D: {},
        F: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'UPDATE_BUTTON_CLICKED' });

    expect(actorRef.getSnapshot().value).toEqual('D');
  });

  it('should choose the final candidate without a guard if none others match', () => {
    const machine = createMachine({
      // types: {} as { context: { data: boolean; status?: string } },
      schemas: {
        context: z.object({
          data: z.boolean(),
          status: z.string().optional()
        })
      },
      context: { data: true },
      initial: 'G',
      states: {
        G: {
          on: { UPDATE_BUTTON_CLICKED: 'E' }
        },
        E: {
          always: ({ context }) => {
            if (!context.data) {
              return { target: 'D' };
            } else {
              return { target: 'F' };
            }
          }
        },
        D: {},
        F: {}
      }
    });
    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'UPDATE_BUTTON_CLICKED' });

    expect(actorRef.getSnapshot().value).toEqual('F');
  });

  it('should carry actions from previous transitions within same step', () => {
    const actual: string[] = [];
    const machine = createMachine({
      initial: 'A',
      states: {
        A: {
          exit: (_, enq) => {
            enq(() => void actual.push('exit_A'));
          },
          on: {
            TIMER: (_, enq) => {
              enq(() => void actual.push('timer'));
              return { target: 'T' };
            }
          }
        },
        T: {
          always: { target: 'B' }
        },
        B: {
          entry: (_, enq) => {
            enq(() => void actual.push('enter_B'));
          }
        }
      }
    });

    const actor = createActor(machine).start();

    actor.send({ type: 'TIMER' });

    expect(actual).toEqual(['exit_A', 'timer', 'enter_B']);
  });

  it('should execute all internal events one after the other', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        A: {
          initial: 'A1',
          states: {
            A1: {
              on: {
                E: 'A2'
              }
            },
            A2: {
              entry: (_, enq) => {
                enq.raise({ type: 'INT1' });
              }
            }
          }
        },

        B: {
          initial: 'B1',
          states: {
            B1: {
              on: {
                E: 'B2'
              }
            },
            B2: {
              entry: (_, enq) => {
                enq.raise({ type: 'INT2' });
              }
            }
          }
        },

        C: {
          initial: 'C1',
          states: {
            C1: {
              on: {
                INT1: 'C2',
                INT2: 'C3'
              }
            },
            C2: {
              on: {
                INT2: 'C4'
              }
            },
            C3: {
              on: {
                INT1: 'C4'
              }
            },
            C4: {}
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'E' });

    expect(actorRef.getSnapshot().value).toEqual({ A: 'A2', B: 'B2', C: 'C4' });
  });

  it('should execute all eventless transitions in the same microstep', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        A: {
          initial: 'A1',
          states: {
            A1: {
              on: {
                E: 'A2' // the external event
              }
            },
            A2: {
              always: 'A3'
            },
            A3: {
              always: ({ value }) => {
                if (matchesState({ B: 'B3' }, value)) {
                  return { target: 'A4' };
                }
              }
            },
            A4: {}
          }
        },

        B: {
          initial: 'B1',
          states: {
            B1: {
              on: {
                E: 'B2'
              }
            },
            B2: {
              always: ({ value }) => {
                if (matchesState({ A: 'A2' }, value)) {
                  return { target: 'B3' };
                }
              }
            },
            B3: {
              always: ({ value }) => {
                if (matchesState({ A: 'A3' }, value)) {
                  return { target: 'B4' };
                }
              }
            },
            B4: {}
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'E' });

    expect(actorRef.getSnapshot().value).toEqual({ A: 'A4', B: 'B4' });
  });

  it('should check for automatic transitions even after microsteps are done', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        A: {
          initial: 'A1',
          states: {
            A1: {
              on: {
                A: 'A2'
              }
            },
            A2: {}
          }
        },
        B: {
          initial: 'B1',
          states: {
            B1: {
              always: ({ value }) => {
                if (matchesState({ A: 'A2' }, value)) {
                  return { target: 'B2' };
                }
              }
            },
            B2: {}
          }
        },
        C: {
          initial: 'C1',
          states: {
            C1: {
              always: ({ value }) => {
                if (matchesState({ A: 'A2' }, value)) {
                  return { target: 'C2' };
                }
              }
            },
            C2: {}
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'A' });

    expect(actorRef.getSnapshot().value).toEqual({ A: 'A2', B: 'B2', C: 'C2' });
  });

  it('should determine the resolved initial state from the transient state', () => {
    expect(createActor(greetingMachine).getSnapshot().value).toEqual('morning');
  });

  it('should determine the resolved state from an initial transient state', () => {
    const actorRef = createActor(greetingMachine).start();

    actorRef.send({ type: 'CHANGE' });
    expect(actorRef.getSnapshot().value).toEqual('morning');

    actorRef.send({ type: 'RECHECK' });
    expect(actorRef.getSnapshot().value).toEqual('evening');
  });

  it('should select eventless transition before processing raised events', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            FOO: 'b'
          }
        },
        b: {
          entry: (_, enq) => {
            enq.raise({ type: 'BAR' });
          },
          always: 'c',
          on: {
            BAR: 'd'
          }
        },
        c: {
          on: {
            BAR: 'e'
          }
        },
        d: {},
        e: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'FOO' });

    expect(actorRef.getSnapshot().value).toBe('e');
  });

  it('should not select wildcard for eventless transition', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { FOO: 'b' }
        },
        b: {
          always: 'pass',
          on: {
            '*': 'fail'
          }
        },
        fail: {},
        pass: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'FOO' });

    expect(actorRef.getSnapshot().value).toBe('pass');
  });

  it('should work with transient transition on root', () => {
    const machine = createMachine({
      // types: {} as { context: { count: number } },
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      id: 'machine',
      initial: 'first',
      context: { count: 0 },
      states: {
        first: {
          on: {
            ADD: ({ context }) => ({
              context: {
                count: context.count + 1
              }
            })
          }
        },
        success: {
          type: 'final'
        }
      },

      always: ({ context }) => {
        if (context.count > 0) {
          return { target: '.success' };
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'ADD' });

    expect(actorRef.getSnapshot().status).toBe('done');
  });

  it("shouldn't crash when invoking a machine with initial transient transition depending on custom data", () => {
    const timerMachine = createMachine({
      initial: 'initial',
      schemas: {
        context: z.object({
          duration: z.number()
        }),
        input: z.object({
          duration: z.number()
        })
      },
      context: ({ input }: { input: { duration: number } }) => ({
        duration: input.duration
      }),
      states: {
        initial: {
          always: ({ context }) => {
            if (context.duration < 1000) {
              return { target: 'finished' };
            } else {
              return { target: 'active' };
            }
          }
        },
        active: {},
        finished: { type: 'final' }
      }
    });

    const machine = createMachine({
      schemas: {
        context: z.object({
          customDuration: z.number()
        })
      },
      initial: 'active',
      context: {
        customDuration: 3000
      },
      states: {
        active: {
          invoke: {
            src: timerMachine,
            input: ({ context }) => ({
              duration: context.customDuration
            })
          }
        }
      }
    });

    const actorRef = createActor(machine);
    expect(() => actorRef.start()).not.toThrow();
  });

  it('should be taken even in absence of other transitions', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          always: ({ event }) => {
            if (event.type === 'WHATEVER') {
              return { target: 'b' };
            }
          }
        },
        b: {}
      }
    });
    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'WHATEVER' });

    expect(actorRef.getSnapshot().value).toBe('b');
  });

  it('should select subsequent transient transitions even in absence of other transitions', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          always: ({ event }) => {
            if (event.type === 'WHATEVER') {
              return { target: 'b' };
            }
          }
        },
        b: {
          always: () => {
            if (true) {
              return { target: 'c' };
            }
          }
        },
        c: {}
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'WHATEVER' });

    expect(actorRef.getSnapshot().value).toBe('c');
  });

  it('events that trigger eventless transitions should be preserved in guards', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: 'b'
          }
        },
        b: {
          always: 'c'
        },
        c: {
          always: ({ event }) => {
            expect(event.type).toEqual('EVENT');
            if (event.type === 'EVENT') {
              return { target: 'd' };
            }
          }
        },
        d: { type: 'final' }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().status).toBe('done');
  });

  it('events that trigger eventless transitions should be preserved in actions', () => {
    expect.assertions(2);

    const machine = createMachine({
      schemas: {
        events: {
          EVENT: z.object({ value: z.number() })
        }
      },
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: 'b'
          }
        },
        b: {
          always: ({ event }, enq) => {
            enq(() => void expect(event).toEqual({ type: 'EVENT', value: 42 }));
            return { target: 'c' };
          }
        },
        c: {
          entry: ({ event }, enq) => {
            enq(() => void expect(event).toEqual({ type: 'EVENT', value: 42 }));
          }
        }
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'EVENT', value: 42 });
  });

  it("shouldn't end up in an infinite loop when selecting the fallback target", () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            event: 'active'
          }
        },
        active: {
          initial: 'a',
          states: {
            a: {},
            b: {}
          },
          always: () => {
            if (1 + 1 === 3) {
              return { target: '.a' };
            } else {
              return { target: '.b' };
            }
          }
        }
      }
    });
    const actorRef = createActor(machine).start();
    actorRef.send({
      type: 'event'
    });

    expect(actorRef.getSnapshot().value).toEqual({ active: 'b' });
  });

  it("shouldn't end up in an infinite loop when selecting a guarded target", () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            event: 'active'
          }
        },
        active: {
          initial: 'a',
          states: {
            a: {},
            b: {}
          },
          always: () => {
            if (1 + 1 === 2) {
              return { target: '.a' };
            } else {
              return { target: '.b' };
            }
          }
        }
      }
    });
    const actorRef = createActor(machine).start();
    actorRef.send({
      type: 'event'
    });

    expect(actorRef.getSnapshot().value).toEqual({ active: 'a' });
  });

  it("shouldn't end up in an infinite loop when executing a fire-and-forget action that doesn't change state", () => {
    let count = 0;
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            event: 'active'
          }
        },
        active: {
          initial: 'a',
          states: {
            a: {}
          },
          always: (_, enq) => {
            enq(() => {
              count++;
              if (count > 5) {
                throw new Error('Infinite loop detected');
              }
            });
            return { target: '.a' };
          }
        }
      }
    });

    const actorRef = createActor(machine);

    actorRef.start();
    actorRef.send({
      type: 'event'
    });

    expect(actorRef.getSnapshot().value).toEqual({ active: 'a' });
    expect(count).toBe(1);
  });

  it('should loop (but not infinitely) for assign actions', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context: { count: 0 },
      initial: 'counting',
      states: {
        counting: {
          always: ({ context }) => {
            if (context.count < 5) {
              return {
                context: { count: context.count + 1 }
              };
            }
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    expect(actorRef.getSnapshot().context.count).toEqual(5);
  });

  it("should execute an always transition after a raised transition even if that raised transition doesn't change the state", () => {
    const spy = vi.fn();
    let counter = 0;
    const machine = createMachine({
      always: (_, enq) => {
        enq((...args) => {
          spy(...args);
        }, counter);
      },
      on: {
        EV: (_, enq) => {
          enq.raise({ type: 'RAISED' });
        },
        RAISED: (_, enq) => {
          enq(() => {
            ++counter;
          });
        }
      }
    });
    const actorRef = createActor(machine).start();
    spy.mockClear();
    actorRef.send({ type: 'EV' });

    expect(spy.mock.calls).toEqual([
      // called in response to the `EV` event
      [0],
      // called in response to the `RAISED` event
      [1]
    ]);
  });
});
