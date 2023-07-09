import { createMachine, interpret } from '../src/index.ts';
import { after } from '../src/actions';

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

afterEach(() => {
  jest.useRealTimers();
});

describe('delayed transitions', () => {
  it('should transition after delay', () => {
    jest.useFakeTimers();

    const actorRef = interpret(lightMachine).start();
    expect(actorRef.getSnapshot().value).toBe('green');

    jest.advanceTimersByTime(500);
    expect(actorRef.getSnapshot().value).toBe('green');

    jest.advanceTimersByTime(510);
    expect(actorRef.getSnapshot().value).toBe('yellow');
  });

  it('should format transitions properly', () => {
    const greenNode = lightMachine.states.green;

    const transitions = greenNode.transitions;

    expect([...transitions.keys()]).toEqual([after(1000, greenNode.id)]);
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

    const actor = interpret(machine);
    actor.subscribe({
      complete: () => {
        done();
      }
    });
    actor.start();
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

    const actor = interpret(machine);
    actor.subscribe({
      complete: () => {
        expect(actual).toEqual(['entered one', 'entered two', 'entered three']);
        done();
      }
    });
    actor.start();
  });

  it('should defer a single send event for a delayed conditional transition (#886)', () => {
    jest.useFakeTimers();
    const spy = jest.fn();
    const machine = createMachine({
      initial: 'X',
      states: {
        X: {
          after: {
            1: [
              {
                target: 'Y',
                guard: () => true
              },
              {
                target: 'Z'
              }
            ]
          }
        },
        Y: {
          on: {
            '*': {
              actions: spy
            }
          }
        },
        Z: {}
      }
    });

    interpret(machine).start();

    jest.advanceTimersByTime(10);
    expect(spy).not.toHaveBeenCalled();
  });

  // TODO: figure out correct behavior for restoring delayed transitions
  it.skip('should execute an after transition after starting from a state resolved using `.getPersistedState`', (done) => {
    const machine = createMachine({
      id: 'machine',
      initial: 'a',
      states: {
        a: {
          on: { next: 'withAfter' }
        },

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

    const actorRef1 = interpret(machine).start();
    actorRef1.send({ type: 'next' });
    const withAfterState = actorRef1.getPersistedState();

    const actorRef2 = interpret(machine, { state: withAfterState });
    actorRef2.subscribe({ complete: () => done() });
    actorRef2.start();
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

    const persistedState = JSON.parse(JSON.stringify(service.getSnapshot()));

    service = interpret(createMyMachine(), { state: persistedState }).start();

    service.send({ type: 'NEXT' });

    service.subscribe({ complete: () => done() });
  });

  describe('delay expressions', () => {
    it('should evaluate the expression (function) to determine the delay', () => {
      jest.useFakeTimers();
      const spy = jest.fn();
      const context = {
        delay: 500
      };
      const machine = createMachine({
        initial: 'inactive',
        context,
        states: {
          inactive: {
            after: [
              {
                delay: ({ context }) => {
                  spy(context);
                  return context.delay;
                },
                target: 'active'
              }
            ]
          },
          active: {}
        }
      });

      const actor = interpret(machine).start();

      expect(spy).toBeCalledWith(context);
      expect(actor.getSnapshot().value).toBe('inactive');

      jest.advanceTimersByTime(300);
      expect(actor.getSnapshot().value).toBe('inactive');

      jest.advanceTimersByTime(200);
      expect(actor.getSnapshot().value).toBe('active');
    });

    it('should evaluate the expression (string) to determine the delay', () => {
      jest.useFakeTimers();
      const spy = jest.fn();
      const machine = createMachine(
        {
          initial: 'inactive',
          states: {
            inactive: {
              on: {
                ACTIVATE: 'active'
              }
            },
            active: {
              after: [
                {
                  delay: 'someDelay',
                  target: 'inactive'
                }
              ]
            }
          }
        },
        {
          delays: {
            someDelay: ({ event }) => {
              spy(event);
              return (event as any).delay;
            }
          }
        }
      );

      const actor = interpret(machine).start();

      const event = {
        type: 'ACTIVATE',
        delay: 500
      } as const;
      actor.send(event);

      expect(spy).toBeCalledWith(event);
      expect(actor.getSnapshot().value).toBe('active');

      jest.advanceTimersByTime(300);
      expect(actor.getSnapshot().value).toBe('active');

      jest.advanceTimersByTime(200);
      expect(actor.getSnapshot().value).toBe('inactive');
    });
  });
});
