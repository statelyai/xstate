import { createMachine, interpret } from '../src/index';
import { raise } from '../src/actions/raise';
import { assign } from '../src/actions/assign';
import { stateIn } from '../src/guards';

const greetingContext = { hour: 10 };
const greetingMachine = createMachine<typeof greetingContext>({
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
    const machine = createMachine<{ data: boolean; status?: string }>({
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

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'UPDATE_BUTTON_CLICKED' });

    expect(actorRef.getSnapshot().value).toEqual('D');
  });

  it('should choose the first candidate target that matches the guard 2', () => {
    const machine = createMachine<{ data: boolean; status?: string }>({
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

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'UPDATE_BUTTON_CLICKED' });

    expect(actorRef.getSnapshot().value).toEqual('D');
  });

  it('should choose the final candidate without a guard if none others match', () => {
    const machine = createMachine<{ data: boolean; status?: string }>({
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
    const actorRef = interpret(machine).start();
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

    const actor = interpret(machine).start();

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

    const actorRef = interpret(machine).start();
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

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'E' });

    expect(actorRef.getSnapshot().value).toEqual({ A: 'A4', B: 'B4' });
  });

  it('should execute all eventless transitions in the same microstep (with `always`)', () => {
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

    const actorRef = interpret(machine).start();
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

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'A' });

    expect(actorRef.getSnapshot().value).toEqual({ A: 'A2', B: 'B2', C: 'C2' });
  });

  it('should check for automatic transitions even after microsteps are done (with `always`)', () => {
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
            A2: { id: 'A2' }
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
                guard: stateIn('#A2')
              }
            },
            C2: {}
          }
        }
      }
    });

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'A' });

    expect(actorRef.getSnapshot().value).toEqual({ A: 'A2', B: 'B2', C: 'C2' });
  });

  it('should determine the resolved initial state from the transient state', () => {
    expect(interpret(greetingMachine).getSnapshot().value).toEqual('morning');
  });

  it('should determine the resolved state from an initial transient state', () => {
    const actorRef = interpret(greetingMachine).start();

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

    const actorRef = interpret(machine).start();
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
          on: { '*': 'fail' }
        },
        fail: {}
      }
    });

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'FOO' });

    expect(actorRef.getSnapshot().value).toBe('b');
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

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'FOO' });

    expect(actorRef.getSnapshot().value).toBe('pass');
  });

  it('should work with transient transition on root', () => {
    const machine = createMachine<{ count: number }, any>({
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

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'ADD' });

    expect(actorRef.getSnapshot().done).toBe(true);
  });

  it('should work with transient transition on root (with `always`)', () => {
    const machine = createMachine<{ count: number }, any>({
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

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'ADD' });

    expect(actorRef.getSnapshot().done).toBe(true);
  });

  it("shouldn't crash when invoking a machine with initial transient transition depending on custom data", () => {
    const timerMachine = createMachine({
      initial: 'initial',
      context: ({ input }) => ({
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
            input: {
              duration: (context: any) => context.customDuration
            }
          }
        }
      }
    });

    const actorRef = interpret(machine);
    expect(() => actorRef.start()).not.toThrow();
  });

  it('should be taken even in absence of other transitions', () => {
    let shouldMatch = false;

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          always: {
            target: 'b',
            // TODO: in v5 remove `shouldMatch` and replace this guard with:
            // guard: (ctx, ev) => ev.type === 'WHATEVER'
            guard: () => shouldMatch
          }
        },
        b: {}
      }
    });
    const actorRef = interpret(machine).start();

    shouldMatch = true;
    actorRef.send({ type: 'WHATEVER' });

    expect(actorRef.getSnapshot().value).toBe('b');
  });

  it('should select subsequent transient transitions even in absence of other transitions', () => {
    let shouldMatch = false;

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          always: {
            target: 'b',
            // TODO: in v5 remove `shouldMatch` and replace this guard with:
            // guard: (ctx, ev) => ev.type === 'WHATEVER'
            guard: () => shouldMatch
          }
        },
        b: {
          always: {
            target: 'c',
            guard: () => true
          }
        },
        c: {}
      }
    });

    const actorRef = interpret(machine).start();

    shouldMatch = true;
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

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().done).toBeTruthy();
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

    const service = interpret(machine).start();
    service.send({ type: 'EVENT', value: 42 });
  });
});
