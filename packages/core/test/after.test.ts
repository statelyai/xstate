import { createMachine, interpret, State } from '../src';
import { after, cancel, send, actionTypes } from '../src/actions';
import { toSCXMLEvent } from '../src/utils';

const lightMachine = createMachine({
  id: 'light',
  initial: 'green',
  context: {
    canTurnGreen: true
  },
  states: {
    green: {
      after: {
        1000: 'yellow'
      }
    },
    yellow: {
      after: {
        1000: [{ target: 'red' }]
      }
    },
    red: {
      after: [{ delay: 1000, target: 'green' }]
    }
  }
});

describe('delayed transitions', () => {
  it('should transition after delay', () => {
    const nextState = lightMachine.transition(
      lightMachine.initialState,
      after(1000, 'light.green')
    );

    expect(nextState.value).toEqual('yellow');
    expect(nextState.actions).toEqual([
      cancel(after(1000, 'light.green')),
      {
        ...send(after(1000, 'light.yellow'), { delay: 1000 }),
        _event: toSCXMLEvent(after(1000, 'light.yellow'))
      }
    ]);
  });

  it('should format transitions properly', () => {
    const greenNode = lightMachine.states.green;

    const transitions = greenNode.transitions;

    expect(transitions.map((t) => t.eventType)).toEqual([
      after(1000, greenNode.id)
    ]);
  });

  it('should be able to transition with delay from nested initial state', (done) => {
    const machine = createMachine({
      initial: 'nested',
      states: {
        nested: {
          initial: 'wait',
          states: {
            wait: {
              after: {
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
          after: {
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

  it('should defer a single send event for a delayed transition with multiple conditions (#886)', () => {
    type Events = { type: 'FOO' };

    const machine = createMachine<{}, Events>({
      initial: 'X',
      states: {
        X: {
          on: {
            FOO: 'X'
          },
          after: {
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

  it('should execute an after transition after starting from a state resolved using `machine.getInitialState`', (done) => {
    const machine = createMachine({
      id: 'machine',
      initial: 'a',
      states: {
        a: {},

        withAfter: {
          after: {
            1: { target: 'done' }
          }
        },

        done: {
          type: 'final'
        }
      }
    });

    interpret(machine)
      .onDone(() => done())
      .start(machine.getInitialState('withAfter'));
  });

  it('should execute an after transition after starting from a persisted state', (done) => {
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
            after: {
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

  describe('delay expressions', () => {
    type Events =
      | { type: 'ACTIVATE'; delay: number }
      | { type: 'NOEXPR'; delay: number };
    const delayExprMachine = createMachine<{ delay: number }, Events>(
      {
        id: 'delayExpr',
        initial: 'inactive',
        context: {
          delay: 1000
        },
        states: {
          inactive: {
            after: [
              {
                delay: (ctx) => ctx.delay,
                target: 'active'
              }
            ],
            on: {
              ACTIVATE: 'active',
              NOEXPR: 'activeNoExpr'
            }
          },
          active: {
            after: [
              {
                delay: 'someDelay',
                target: 'inactive'
              }
            ]
          },
          activeNoExpr: {
            after: [
              {
                delay: 'nonExistantDelay',
                target: 'inactive'
              }
            ]
          }
        }
      },
      {
        delays: {
          someDelay: (ctx, event) => ctx.delay + (event as any).delay
        }
      }
    );

    it('should evaluate the expression (function) to determine the delay', () => {
      const { initialState } = delayExprMachine;

      const sendActions = initialState.actions.filter(
        (a) => a.type === actionTypes.send
      );

      expect(sendActions.length).toBe(1);

      expect((sendActions as any)[0].delay).toEqual(1000);
    });

    it('should evaluate the expression (string) to determine the delay', () => {
      const { initialState } = delayExprMachine;
      const activeState = delayExprMachine.transition(initialState, {
        type: 'ACTIVATE',
        delay: 500
      });

      const sendActions = activeState.actions.filter(
        (a) => a.type === actionTypes.send
      );

      expect(sendActions.length).toBe(1);

      expect((sendActions as any)[0].delay).toEqual(1000 + 500);
    });

    it('should set delay to undefined if expression not found', () => {
      const { initialState } = delayExprMachine;
      const activeState = delayExprMachine.transition(initialState, {
        type: 'NOEXPR',
        delay: 500
      });

      const sendActions = activeState.actions.filter(
        (a) => a.type === actionTypes.send
      );

      expect(sendActions.length).toBe(1);

      expect((sendActions as any)[0].delay).toEqual(undefined);
    });
  });
});
