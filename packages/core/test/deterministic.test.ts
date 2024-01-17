import { fromCallback, createActor, getNextSnapshot } from '../src/index.ts';
import { createMachine } from '../src/createMachine.ts';
import { getInitialSnapshot } from '../src/getNextSnapshot.ts';

describe('deterministic machine', () => {
  const lightMachine = createMachine({
    initial: 'green',
    states: {
      green: {
        on: {
          TIMER: 'yellow',
          POWER_OUTAGE: 'red'
        }
      },
      yellow: {
        on: {
          TIMER: 'red',
          POWER_OUTAGE: 'red'
        }
      },
      red: {
        on: {
          TIMER: 'green',
          POWER_OUTAGE: 'red'
        },
        initial: 'walk',
        states: {
          walk: {
            on: {
              PED_COUNTDOWN: 'wait',
              TIMER: undefined // forbidden event
            }
          },
          wait: {
            on: {
              PED_COUNTDOWN: 'stop',
              TIMER: undefined // forbidden event
            }
          },
          stop: {}
        }
      }
    }
  });

  const testMachine = createMachine({
    initial: 'a',
    states: {
      a: {
        on: {
          T: 'b.b1',
          F: 'c'
        }
      },
      b: {
        initial: 'b1',
        states: {
          b1: {}
        }
      },
      c: {}
    }
  });

  describe('machine transitions', () => {
    it('should properly transition states based on event-like object', () => {
      expect(
        getNextSnapshot(
          lightMachine,
          lightMachine.resolveState({ value: 'green' }),
          {
            type: 'TIMER'
          }
        ).value
      ).toEqual('yellow');
    });

    it('should not transition states for illegal transitions', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: { NEXT: 'b' }
          },
          b: {}
        }
      });

      const actor = createActor(machine).start();

      const previousSnapshot = actor.getSnapshot();

      actor.send({
        type: 'FAKE'
      });

      expect(actor.getSnapshot().value).toBe('a');
      expect(actor.getSnapshot()).toBe(previousSnapshot);
    });

    it('should throw an error if not given an event', () => {
      expect(() =>
        getNextSnapshot(
          lightMachine,
          testMachine.resolveState({ value: 'red' }),
          undefined as any
        )
      ).toThrow();
    });

    it('should transition to nested states as target', () => {
      expect(
        getNextSnapshot(testMachine, testMachine.resolveState({ value: 'a' }), {
          type: 'T'
        }).value
      ).toEqual({
        b: 'b1'
      });
    });

    it('should throw an error for transitions from invalid states', () => {
      expect(() =>
        getNextSnapshot(
          testMachine,
          testMachine.resolveState({ value: 'fake' }),
          { type: 'T' }
        )
      ).toThrow();
    });

    it('should throw an error for transitions from invalid substates', () => {
      expect(() =>
        getNextSnapshot(
          testMachine,
          testMachine.resolveState({ value: 'a.fake' }),
          {
            type: 'T'
          }
        )
      ).toThrow();
    });

    it('should use the machine.initialState when an undefined state is given', () => {
      const init = getInitialSnapshot(lightMachine, undefined);
      expect(
        getNextSnapshot(lightMachine, init, { type: 'TIMER' }).value
      ).toEqual('yellow');
    });

    it('should use the machine.initialState when an undefined state is given (unhandled event)', () => {
      const init = getInitialSnapshot(lightMachine, undefined);
      expect(
        getNextSnapshot(lightMachine, init, { type: 'TIMER' }).value
      ).toEqual('yellow');
    });
  });

  describe('machine transition with nested states', () => {
    it('should properly transition a nested state', () => {
      expect(
        getNextSnapshot(
          lightMachine,
          lightMachine.resolveState({ value: { red: 'walk' } }),
          { type: 'PED_COUNTDOWN' }
        ).value
      ).toEqual({ red: 'wait' });
    });

    it('should transition from initial nested states', () => {
      expect(
        getNextSnapshot(
          lightMachine,
          lightMachine.resolveState({ value: 'red' }),
          {
            type: 'PED_COUNTDOWN'
          }
        ).value
      ).toEqual({
        red: 'wait'
      });
    });

    it('should transition from deep initial nested states', () => {
      expect(
        getNextSnapshot(
          lightMachine,
          lightMachine.resolveState({ value: 'red' }),
          {
            type: 'PED_COUNTDOWN'
          }
        ).value
      ).toEqual({
        red: 'wait'
      });
    });

    it('should bubble up events that nested states cannot handle', () => {
      expect(
        getNextSnapshot(
          lightMachine,
          lightMachine.resolveState({ value: { red: 'stop' } }),
          { type: 'TIMER' }
        ).value
      ).toEqual('green');
    });

    it('should not transition from illegal events', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'b',
            states: {
              b: {
                on: { NEXT: 'c' }
              },
              c: {}
            }
          }
        }
      });

      const actor = createActor(machine).start();

      const previousSnapshot = actor.getSnapshot();

      actor.send({
        type: 'FAKE'
      });

      expect(actor.getSnapshot().value).toEqual({ a: 'b' });
      expect(actor.getSnapshot()).toBe(previousSnapshot);
    });

    it('should transition to the deepest initial state', () => {
      expect(
        getNextSnapshot(
          lightMachine,
          lightMachine.resolveState({ value: 'yellow' }),
          {
            type: 'TIMER'
          }
        ).value
      ).toEqual({
        red: 'walk'
      });
    });

    it('should return the same state if no transition occurs', () => {
      const init = getInitialSnapshot(lightMachine, undefined);
      const initialState = getNextSnapshot(lightMachine, init, {
        type: 'NOTHING'
      });
      const nextState = getNextSnapshot(lightMachine, initialState, {
        type: 'NOTHING'
      });

      expect(initialState.value).toEqual(nextState.value);
      expect(nextState).toBe(initialState);
    });
  });

  describe('state key names', () => {
    const machine = createMachine(
      {
        initial: 'test',
        states: {
          test: {
            invoke: [{ src: 'activity' }],
            entry: ['onEntry'],
            on: {
              NEXT: 'test'
            },
            exit: ['onExit']
          }
        }
      },
      {
        actors: {
          activity: fromCallback(() => () => {})
        }
      }
    );

    it('should work with substate nodes that have the same key', () => {
      const init = getInitialSnapshot(machine, undefined);
      expect(getNextSnapshot(machine, init, { type: 'NEXT' }).value).toEqual(
        'test'
      );
    });
  });

  describe('forbidden events', () => {
    it('undefined transitions should forbid events', () => {
      const walkState = getNextSnapshot(
        lightMachine,
        lightMachine.resolveState({ value: { red: 'walk' } }),
        { type: 'TIMER' }
      );

      expect(walkState.value).toEqual({ red: 'walk' });
    });
  });
});
