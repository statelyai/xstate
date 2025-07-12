import { setTimeout as sleep } from 'node:timers/promises';
import {
  createMachine,
  next_createMachine,
  createActor
} from '../src/index.ts';
import z from 'zod';

const lightMachine = next_createMachine({
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
        1000: { target: 'red' }
      }
    },
    red: {
      after: {
        1000: 'green'
      }
    }
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe('delayed transitions', () => {
  it('should transition after delay', () => {
    vi.useFakeTimers();

    const actorRef = createActor(lightMachine).start();
    expect(actorRef.getSnapshot().value).toBe('green');

    vi.advanceTimersByTime(500);
    expect(actorRef.getSnapshot().value).toBe('green');

    vi.advanceTimersByTime(510);
    expect(actorRef.getSnapshot().value).toBe('yellow');
  });

  it('should not try to clear an undefined timeout when exiting source state of a delayed transition', async () => {
    // https://github.com/statelyai/xstate/issues/5001
    const spy = vi.fn();

    const machine = next_createMachine({
      initial: 'green',
      states: {
        green: {
          after: {
            1: 'yellow'
          }
        },
        yellow: {}
      }
    });

    const actorRef = createActor(machine, {
      clock: {
        setTimeout,
        clearTimeout: spy
      }
    }).start();

    // when the after transition gets executed it tries to clear its own timer when exiting its source state
    await sleep(5);
    expect(actorRef.getSnapshot().value).toBe('yellow');
    expect(spy.mock.calls.length).toBe(0);
  });

  it('should format transitions properly', () => {
    const greenNode = lightMachine.states.green;

    const transitions = greenNode.transitions;

    expect([...transitions.keys()]).toMatchInlineSnapshot(`
      [
        "xstate.after.1000.light.green",
      ]
    `);
  });

  it('should be able to transition with delay from nested initial state', () => {
    const { resolve, promise } = Promise.withResolvers<void>();

    const machine = next_createMachine({
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

    const actor = createActor(machine);
    actor.subscribe({
      complete: () => {
        resolve();
      }
    });
    actor.start();

    return promise;
  });

  it('parent state should enter child state without re-entering self (relative target)', () => {
    const { resolve, promise } = Promise.withResolvers<void>();

    const actual: string[] = [];

    const machine = next_createMachine({
      initial: 'one',
      states: {
        one: {
          initial: 'two',
          entry: (_, enq) => enq.action(() => actual.push('entered one')),
          states: {
            two: {
              entry: (_, enq) => enq.action(() => actual.push('entered two'))
            },
            three: {
              entry: (_, enq) => enq.action(() => actual.push('entered three')),
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

    const actor = createActor(machine);
    actor.subscribe({
      complete: () => {
        expect(actual).toEqual(['entered one', 'entered two', 'entered three']);
        resolve();
      }
    });
    actor.start();

    return promise;
  });

  it('should defer a single send event for a delayed conditional transition (#886)', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const machine = next_createMachine({
      initial: 'X',
      states: {
        X: {
          after: {
            // 1: [
            //   {
            //     target: 'Y',
            //     guard: () => true
            //   },
            //   {
            //     target: 'Z'
            //   }
            // ]
            1: () => {
              if (1 + 1 === 2) {
                return { target: 'Y' };
              } else {
                return { target: 'Z' };
              }
            }
          }
        },
        Y: {
          on: {
            // '*': {
            //   actions: spy
            // }
            '*': (_, enq) => enq.action(spy)
          }
        },
        Z: {}
      }
    });

    createActor(machine).start();

    vi.advanceTimersByTime(10);
    expect(spy).not.toHaveBeenCalled();
  });

  // TODO: figure out correct behavior for restoring delayed transitions
  it.skip('should execute an after transition after starting from a state resolved using `.getPersistedSnapshot`', () => {
    const { resolve, promise } = Promise.withResolvers<void>();

    const machine = next_createMachine({
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

    const actorRef1 = createActor(machine).start();
    actorRef1.send({ type: 'next' });
    const withAfterState = actorRef1.getPersistedSnapshot();

    const actorRef2 = createActor(machine, { snapshot: withAfterState });
    actorRef2.subscribe({ complete: () => resolve() });
    actorRef2.start();

    return promise;
  });

  it('should execute an after transition after starting from a persisted state', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const createMyMachine = () =>
      next_createMachine({
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

    let service = createActor(createMyMachine()).start();

    const persistedSnapshot = JSON.parse(JSON.stringify(service.getSnapshot()));

    service = createActor(createMyMachine(), {
      snapshot: persistedSnapshot
    }).start();

    service.send({ type: 'NEXT' });

    service.subscribe({ complete: () => resolve() });

    return promise;
  });

  describe('delay expressions', () => {
    it('should evaluate the expression (function) to determine the delay', () => {
      vi.useFakeTimers();
      const spy = vi.fn();
      const context = {
        delay: 500
      };
      const machine = next_createMachine({
        initial: 'inactive',
        context,
        delays: {
          myDelay: ({ context }) => {
            spy(context);
            return context.delay;
          }
        },
        states: {
          inactive: {
            after: { myDelay: 'active' }
          },
          active: {}
        }
      });

      const actor = createActor(machine).start();

      expect(spy).toBeCalledWith(context);
      expect(actor.getSnapshot().value).toBe('inactive');

      vi.advanceTimersByTime(300);
      expect(actor.getSnapshot().value).toBe('inactive');

      vi.advanceTimersByTime(200);
      expect(actor.getSnapshot().value).toBe('active');
    });

    it('should evaluate the expression (string) to determine the delay', () => {
      vi.useFakeTimers();
      const spy = vi.fn();
      const machine = next_createMachine({
        initial: 'inactive',
        schemas: {
          event: z.object({
            type: z.literal('ACTIVATE'),
            delay: z.number()
          })
        },
        delays: {
          someDelay: ({ event }) => {
            spy(event);
            return event.delay;
          }
        },
        states: {
          inactive: {
            on: {
              ACTIVATE: 'active'
            }
          },
          active: {
            after: {
              someDelay: 'inactive'
            }
          }
        }
      });

      const actor = createActor(machine).start();

      const event = {
        type: 'ACTIVATE',
        delay: 500
      } as const;
      actor.send(event);

      expect(spy).toBeCalledWith(event);
      expect(actor.getSnapshot().value).toBe('active');

      vi.advanceTimersByTime(300);
      expect(actor.getSnapshot().value).toBe('active');

      vi.advanceTimersByTime(200);
      expect(actor.getSnapshot().value).toBe('inactive');
    });
  });
});
