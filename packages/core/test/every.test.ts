import { createMachine, interpret, State } from '../src';
import { actionTypes, every } from '../src/actions';

const lightMachine = createMachine({
  id: 'light',
  initial: 'green',
  context: {
    canTurnGreen: true
  },
  states: {
    green: {
      every: {
        1000: 'yellow'
      }
    },
    yellow: {
      every: {
        1000: [{ target: 'red' }]
      }
    },
    red: {
      every: [{ interval: 1000, target: 'green' }]
    }
  }
});

describe('periodic events', () => {
  it('should format transitions properly', () => {
    const greenNode = lightMachine.states.green;

    const transitions = greenNode.transitions;

    expect(transitions.map((t) => t.eventType)).toEqual([
      every(1000, greenNode.id)
    ]);
  });

  it('should be able to transition after a period from nested initial state', (done) => {
    const machine = createMachine({
      initial: 'nested',
      states: {
        nested: {
          initial: 'wait',
          states: {
            wait: {
              every: {
                10: '#end'
              }
            }
          }
        },
        end: {
          id: 'end',
          type: 'final'
        }
      }
    });

    interpret(machine)
      .onDone(() => {
        done();
      })
      .start();
  });

  it('parent state should enter child state without re-entering self (relative target)', (done) => {
    const actual: string[] = [];
    const machine = createMachine({
      initial: 'one',
      states: {
        one: {
          initial: 'two',
          entry: () => actual.push('entered one'),
          states: {
            two: {
              entry: () => actual.push('entered two')
            },
            three: {
              entry: () => actual.push('entered three'),
              always: '#end'
            }
          },
          every: {
            10: '.three'
          }
        },
        end: {
          id: 'end',
          type: 'final'
        }
      }
    });

    interpret(machine)
      .onDone(() => {
        expect(actual).toEqual(['entered one', 'entered two', 'entered three']);
        done();
      })
      .start();
  });

  it('should defer a single send event for a periodic transition with multiple conditions (#886)', () => {
    type Events = { type: 'FOO' };

    const machine = createMachine<{}, Events>({
      initial: 'X',
      states: {
        X: {
          on: {
            FOO: 'X'
          },
          every: {
            1500: [
              {
                target: 'Y',
                cond: () => true
              },
              {
                target: 'Z'
              }
            ]
          }
        },
        Y: {},
        Z: {}
      }
    });

    expect(machine.initialState.actions.length).toBe(1);
  });

  it('should execute a periodic event after starting from a persisted state', (done) => {
    const createMyMachine = () =>
      createMachine({
        initial: 'A',
        states: {
          A: {
            on: {
              NEXT: 'B'
            }
          },
          B: {
            every: {
              1: 'C'
            }
          },
          C: {
            type: 'final'
          }
        }
      });

    let service = interpret(createMyMachine()).start();

    const persistedState = State.create(
      JSON.parse(JSON.stringify(service.state))
    );

    service = interpret(createMyMachine()).start(persistedState);

    service.send({ type: 'NEXT' });

    service.onDone(() => done());
  });

  describe('period expressions', () => {
    type Events =
      | { type: 'ACTIVATE'; delay: number }
      | { type: 'NOEXPR'; delay: number };
    const delayExprMachine = createMachine<{ interval: number }, Events>(
      {
        id: 'delayExpr',
        initial: 'inactive',
        context: {
          interval: 1000
        },
        states: {
          inactive: {
            every: [
              {
                interval: (ctx) => ctx.interval,
                target: 'active'
              }
            ],
            on: {
              ACTIVATE: 'active',
              NOEXPR: 'activeNoExpr'
            }
          },
          active: {
            every: [
              {
                interval: 'somePeriod',
                target: 'inactive'
              }
            ]
          },
          activeNoExpr: {
            every: [
              {
                interval: 'nonExistantPeriod',
                target: 'inactive'
              }
            ]
          }
        }
      },
      {
        intervals: {
          somePeriod: (ctx, event) => ctx.interval + (event as any).interval
        }
      }
    );

    it('should evaluate the expression (function) to determine the period', () => {
      const { initialState } = delayExprMachine;

      const sendActions = initialState.actions.filter(
        (a) => a.type === actionTypes.send
      );

      expect(sendActions.length).toBe(1);

      expect(sendActions[0].interval).toEqual(1000);
    });
  });
});
