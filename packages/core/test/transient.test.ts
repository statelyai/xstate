import { AnyState, createMachine, interpret, State } from '../src/index';
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
  const updateMachine = createMachine<{ data: boolean; status?: string }>({
    initial: 'G',
    states: {
      G: {
        on: { UPDATE_BUTTON_CLICKED: 'E' }
      },
      E: {
        always: [
          { target: 'D', guard: ({ context: { data } }) => !data }, // no data returned
          { target: 'B', guard: ({ context: { status } }) => status === 'Y' },
          { target: 'C', guard: ({ context: { status } }) => status === 'X' },
          { target: 'F' } // default, or just the string 'F'
        ]
      },
      D: {},
      B: {},
      C: {},
      F: {}
    }
  });

  it('should choose the first candidate target that matches the guard (D)', () => {
    const nextState = updateMachine.transition(
      State.from<any>(
        'G',
        {
          data: false
        },
        updateMachine
      ),
      { type: 'UPDATE_BUTTON_CLICKED' }
    );
    expect(nextState.value).toEqual('D');
  });

  it('should choose the first candidate target that matches the guard (B)', () => {
    const nextState = updateMachine.transition(
      State.from<any>(
        'G',
        {
          data: true,
          status: 'Y'
        },
        updateMachine
      ),
      { type: 'UPDATE_BUTTON_CLICKED' }
    );
    expect(nextState.value).toEqual('B');
  });

  it('should choose the first candidate target that matches the guard (C)', () => {
    const nextState = updateMachine.transition(
      State.from(
        'G',
        {
          data: true,
          status: 'X'
        },
        updateMachine
      ) as AnyState,
      { type: 'UPDATE_BUTTON_CLICKED' }
    );
    expect(nextState.value).toEqual('C');
  });

  it('should choose the final candidate without a guard if none others match', () => {
    const nextState = updateMachine.transition(
      State.from(
        'G',
        {
          data: true,
          status: 'other'
        },
        updateMachine
      ) as AnyState,
      { type: 'UPDATE_BUTTON_CLICKED' }
    );
    expect(nextState.value).toEqual('F');
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

    const state = machine.transition(machine.initialState, { type: 'E' });

    expect(state.value).toEqual({ A: 'A2', B: 'B2', C: 'C4' });
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

    const state = machine.transition(machine.initialState, { type: 'E' });

    expect(state.value).toEqual({ A: 'A4', B: 'B4' });
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

    const state = machine.transition(machine.initialState, { type: 'E' });

    expect(state.value).toEqual({ A: 'A4', B: 'B4' });
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

    let state = machine.initialState; // A1, B1, C1
    state = machine.transition(state, { type: 'A' }); // A2, B2, C2
    expect(state.value).toEqual({ A: 'A2', B: 'B2', C: 'C2' });
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

    let state = machine.initialState; // A1, B1, C1
    state = machine.transition(state, { type: 'A' }); // A2, B2, C2
    expect(state.value).toEqual({ A: 'A2', B: 'B2', C: 'C2' });
  });

  it('should determine the resolved initial state from the transient state', () => {
    expect(greetingMachine.initialState.value).toEqual('morning');
  });

  it('should determine the resolved state from an initial transient state', () => {
    const morningState = greetingMachine.initialState;
    expect(morningState.value).toEqual('morning');
    const stillMorningState = greetingMachine.transition(morningState, {
      type: 'CHANGE'
    });
    expect(stillMorningState.value).toEqual('morning');
    const eveningState = greetingMachine.transition(stillMorningState, {
      type: 'RECHECK'
    });
    expect(eveningState.value).toEqual('evening');
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

    const state = machine.transition('a', { type: 'FOO' });
    expect(state.value).toBe('e');
  });

  it('should select eventless transition before processing raised events (with `always`)', () => {
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

    const state = machine.transition('a', { type: 'FOO' });
    expect(state.value).toBe('e');
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

    const state = machine.transition('a', { type: 'FOO' });
    expect(state.value).toBe('b');
  });

  it('should not select wildcard for eventless transition (array `.on`)', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { FOO: 'b' }
        },
        b: {
          always: 'pass',
          on: [{ event: '*', target: 'fail' }]
        },
        fail: {},
        pass: {}
      }
    });

    const state = machine.transition('a', { type: 'FOO' });
    expect(state.value).toBe('pass');
  });

  it('should not select wildcard for eventless transition (with `always`)', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { FOO: 'b' }
        },
        b: {
          always: 'pass',
          on: [{ event: '*', target: 'fail' }]
        },
        fail: {},
        pass: {}
      }
    });

    const state = machine.transition('a', { type: 'FOO' });
    expect(state.value).toBe('pass');
  });

  it('should work with transient transition on root', (done) => {
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

    const service = interpret(machine);
    service.subscribe({
      complete: () => {
        done();
      }
    });

    service.start();

    service.send({ type: 'ADD' });
  });

  it('should work with transient transition on root (with `always`)', (done) => {
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

    const service = interpret(machine);
    service.subscribe({
      complete: () => {
        done();
      }
    });

    service.start();

    service.send({ type: 'ADD' });
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

    const service = interpret(machine);
    expect(() => service.start()).not.toThrow();
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
    const service = interpret(machine).start();

    shouldMatch = true;
    service.send({ type: 'WHATEVER' });

    expect(service.getSnapshot().value).toBe('b');
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

    const service = interpret(machine).start();

    shouldMatch = true;
    service.send({ type: 'WHATEVER' });

    expect(service.getSnapshot().value).toBe('c');
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

    const nextState = machine.transition(undefined, { type: 'EVENT' });

    expect(nextState.done).toBeTruthy();
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
