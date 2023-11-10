import { createMachine, createActor } from '../src/index';
import { raise } from '../src/actions/raise';
import { assign } from '../src/actions/assign';
import { stateIn } from '../src/guards';

const greetingContext = { hour: 10 };
const greetingMachine = createMachine({
  types: {} as { context: typeof greetingContext },
  id: 'greeting',
  initial: 'pending',
  context: greetingContext,
  states: {
    pending: {
      always: [
        { target: 'morning', guard: ({ context }) => context.hour < 12 },
        { target: 'afternoon', guard: ({ context }) => context.hour < 18 },
        { target: 'evening' }
      ]
    },
    morning: {},
    afternoon: {},
    evening: {}
  },
  on: {
    CHANGE: { actions: assign({ hour: 20 }) },
    RECHECK: '#greeting'
  }
});

describe('transient states (eventless transitions)', () => {
  it('should choose the first candidate target that matches the guard 1', () => {
    const machine = createMachine({
      types: {} as { context: { data: boolean } },
      context: { data: false },
      initial: 'G',
      states: {
        G: {
          on: { UPDATE_BUTTON_CLICKED: 'E' }
        },
        E: {
          always: [
            { target: 'D', guard: ({ context: { data } }) => !data },
            { target: 'F' }
          ]
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
      types: {} as { context: { data: boolean; status?: string } },
      context: { data: false },
      initial: 'G',
      states: {
        G: {
          on: { UPDATE_BUTTON_CLICKED: 'E' }
        },
        E: {
          always: [
            { target: 'D', guard: ({ context: { data } }) => !data },
            { target: 'F', guard: () => true }
          ]
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
      types: {} as { context: { data: boolean; status?: string } },
      context: { data: true },
      initial: 'G',
      states: {
        G: {
          on: { UPDATE_BUTTON_CLICKED: 'E' }
        },
        E: {
          always: [
            { target: 'D', guard: ({ context: { data } }) => !data },
            { target: 'F' }
          ]
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
          exit: () => actual.push('exit_A'),
          on: {
            TIMER: {
              target: 'T',
              actions: () => actual.push('timer')
            }
          }
        },
        T: {
          always: [{ target: 'B' }]
        },
        B: {
          entry: () => actual.push('enter_B')
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
              entry: raise({ type: 'INT1' })
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
              entry: raise({ type: 'INT2' })
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
              always: {
                target: 'A4',
                guard: stateIn({ B: 'B3' })
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
              always: {
                target: 'B3',
                guard: stateIn({ A: 'A2' })
              }
            },
            B3: {
              always: {
                target: 'B4',
                guard: stateIn({ A: 'A3' })
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
              always: {
                target: 'B2',
                guard: stateIn({ A: 'A2' })
              }
            },
            B2: {}
          }
        },
        C: {
          initial: 'C1',
          states: {
            C1: {
              always: {
                target: 'C2',
                guard: stateIn({ A: 'A2' })
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
          entry: raise({ type: 'BAR' }),
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
      types: {} as { context: { count: number } },
      id: 'machine',
      initial: 'first',
      context: { count: 0 },
      states: {
        first: {
          on: {
            ADD: {
              actions: assign({ count: ({ context }) => context.count + 1 })
            }
          }
        },
        success: {
          type: 'final'
        }
      },
      always: [
        {
          target: '.success',
          guard: ({ context }) => {
            return context.count > 0;
          }
        }
      ]
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'ADD' });

    expect(actorRef.getSnapshot().status).toBe('done');
  });

  it("shouldn't crash when invoking a machine with initial transient transition depending on custom data", () => {
    const timerMachine = createMachine({
      initial: 'initial',
      context: ({ input }: { input: { duration: number } }) => ({
        duration: input.duration
      }),
      types: {
        context: {} as { duration: number }
      },
      states: {
        initial: {
          always: [
            {
              target: `finished`,
              guard: ({ context }) => context.duration < 1000
            },
            {
              target: `active`
            }
          ]
        },
        active: {},
        finished: { type: 'final' }
      }
    });

    const machine = createMachine({
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

  it('should not be taken even in absence of other transitions', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          always: {
            target: 'b',
            guard: ({ event }) => event.type === 'WHATEVER'
          }
        },
        b: {}
      }
    });
    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'WHATEVER' });

    expect(actorRef.getSnapshot().value).toBe('a');
  });

  it('should select subsequent always transitions after selecting a regular transition', () => {
    let shouldMatch = false;

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            FOO: 'b'
          }
        },
        b: {
          always: {
            target: 'c',
            guard: ({ event }) => event.type === 'FOO'
          }
        },
        c: {
          always: {
            target: 'd',
            guard: ({ event }) => event.type === 'FOO'
          }
        },
        d: {}
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'FOO' });

    expect(actorRef.getSnapshot().value).toBe('d');
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
          always: {
            guard: ({ event }) => {
              expect(event.type).toEqual('EVENT');
              return event.type === 'EVENT';
            },
            target: 'd'
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
    expect.assertions(3);

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: 'b'
          }
        },
        b: {
          always: {
            target: 'c',
            actions: ({ event }) => {
              expect(event).toEqual({ type: 'EVENT', value: 42 });
            }
          },
          exit: ({ event }) => {
            expect(event).toEqual({ type: 'EVENT', value: 42 });
          }
        },
        c: {
          entry: ({ event }) => {
            expect(event).toEqual({ type: 'EVENT', value: 42 });
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
          always: [
            {
              guard: () => false,
              target: '.a'
            },
            {
              target: '.b'
            }
          ]
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
          always: [
            {
              guard: () => true,
              target: '.a'
            },
            {
              target: '.b'
            }
          ]
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
          always: [
            {
              actions: () => {
                count++;
                if (count > 5) {
                  throw new Error('Infinite loop detected');
                }
              },
              target: '.a'
            }
          ]
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
      context: { count: 0 },
      initial: 'counting',
      states: {
        counting: {
          always: {
            guard: ({ context }) => context.count < 5,
            actions: assign({ count: ({ context }) => context.count + 1 })
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    expect(actorRef.getSnapshot().context.count).toEqual(5);
  });

  it("should execute an always transition after a raised transition even if that raised transition doesn't change the state", () => {
    const spy = jest.fn();
    let counter = 0;
    const machine = createMachine({
      always: {
        actions: () => spy(counter)
      },
      on: {
        EV: {
          actions: raise({ type: 'RAISED' })
        },
        RAISED: {
          actions: () => {
            ++counter;
          }
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
