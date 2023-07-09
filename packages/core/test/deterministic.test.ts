import { interpret } from '../src/index.ts';
import { createMachine } from '../src/Machine.ts';

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

  describe('machine.transition()', () => {
    it('should properly transition states based on event-like object', () => {
      expect(
        lightMachine.transition(
          lightMachine.resolveStateValue('green'),
          {
            type: 'TIMER'
          },
          undefined as any // TODO: figure out the simulation API
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

      const actor = interpret(machine).start();

      const previousSnapshot = actor.getSnapshot();

      actor.send({
        type: 'FAKE'
      });

      expect(actor.getSnapshot().value).toBe('a');
      expect(actor.getSnapshot()).toBe(previousSnapshot);
    });

    it('should throw an error if not given an event', () => {
      expect(() =>
        lightMachine.transition(
          testMachine.resolveStateValue('red'),
          undefined as any,
          undefined as any // TODO: figure out the simulation API
        )
      ).toThrow();
    });

    it('should transition to nested states as target', () => {
      expect(
        testMachine.transition(
          testMachine.resolveStateValue('a'),
          { type: 'T' },
          undefined as any // TODO: figure out the simulation API
        ).value
      ).toEqual({
        b: 'b1'
      });
    });

    it('should throw an error for transitions from invalid states', () => {
      expect(() =>
        testMachine.transition(
          testMachine.resolveStateValue('fake'),
          { type: 'T' },
          undefined as any // TODO: figure out the simulation API
        )
      ).toThrow();
    });

    it('should throw an error for transitions from invalid substates', () => {
      expect(() =>
        testMachine.transition(
          testMachine.resolveStateValue('a.fake'),
          {
            type: 'T'
          },
          undefined as any // TODO: figure out the simulation API
        )
      ).toThrow();
    });

    it('should use the machine.initialState when an undefined state is given', () => {
      expect(
        lightMachine.transition(
          lightMachine.getInitialState(
            undefined as any // TODO: figure out the simulation API
          ),
          { type: 'TIMER' },
          undefined as any // TODO: figure out the simulation API
        ).value
      ).toEqual('yellow');
    });

    it('should use the machine.initialState when an undefined state is given (unhandled event)', () => {
      expect(
        lightMachine.transition(
          lightMachine.getInitialState(
            undefined as any // TODO: figure out the simulation API
          ),
          { type: 'TIMER' },
          undefined as any // TODO: figure out the simulation API
        ).value
      ).toEqual('yellow');
    });
  });

  // TODO: figure out the simulation API
  describe('machine.transition() with nested states', () => {
    it('should properly transition a nested state', () => {
      expect(
        lightMachine.transition(
          lightMachine.resolveStateValue({ red: 'walk' }),
          { type: 'PED_COUNTDOWN' },
          undefined as any // TODO: figure out the simulation API
        ).value
      ).toEqual({ red: 'wait' });
    });

    it('should transition from initial nested states', () => {
      expect(
        lightMachine.transition(
          lightMachine.resolveStateValue('red'),
          {
            type: 'PED_COUNTDOWN'
          },
          undefined as any // TODO: figure out the simulation API
        ).value
      ).toEqual({
        red: 'wait'
      });
    });

    it('should transition from deep initial nested states', () => {
      expect(
        lightMachine.transition(
          lightMachine.resolveStateValue('red'),
          {
            type: 'PED_COUNTDOWN'
          },
          undefined as any // TODO: figure out the simulation API
        ).value
      ).toEqual({
        red: 'wait'
      });
    });

    it('should bubble up events that nested states cannot handle', () => {
      expect(
        lightMachine.transition(
          lightMachine.resolveStateValue({ red: 'stop' }),
          { type: 'TIMER' },
          undefined as any // TODO: figure out the simulation API
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

      const actor = interpret(machine).start();

      const previousSnapshot = actor.getSnapshot();

      actor.send({
        type: 'FAKE'
      });

      expect(actor.getSnapshot().value).toEqual({ a: 'b' });
      expect(actor.getSnapshot()).toBe(previousSnapshot);
    });

    it('should transition to the deepest initial state', () => {
      expect(
        lightMachine.transition(
          lightMachine.resolveStateValue('yellow'),
          {
            type: 'TIMER'
          },
          undefined as any // TODO: figure out the simulation API
        ).value
      ).toEqual({
        red: 'walk'
      });
    });

    it('should return the same state if no transition occurs', () => {
      const initialState = lightMachine.transition(
        lightMachine.getInitialState(
          undefined as any // TODO: figure out the simulation API
        ),
        {
          type: 'NOTHING'
        },
        undefined as any // TODO: figure out the simulation API
      );
      const nextState = lightMachine.transition(
        initialState,
        {
          type: 'NOTHING'
        },
        undefined as any // TODO: figure out the simulation API
      );

      expect(initialState.value).toEqual(nextState.value);
      expect(nextState).toBe(initialState);
    });
  });

  describe('state key names', () => {
    const machine = createMachine({
      initial: 'test',
      states: {
        test: {
          invoke: ['activity'],
          entry: ['onEntry'],
          on: {
            NEXT: 'test'
          },
          exit: ['onExit']
        }
      }
    });

    it('should work with substate nodes that have the same key', () => {
      expect(
        machine.transition(
          machine.getInitialState(
            undefined as any // TODO: figure out the simulation API
          ),
          { type: 'NEXT' },
          undefined as any // TODO: figure out the simulation API
        ).value
      ).toEqual('test');
    });
  });

  describe('forbidden events', () => {
    it('undefined transitions should forbid events', () => {
      const walkState = lightMachine.transition(
        lightMachine.resolveStateValue({ red: 'walk' }),
        { type: 'TIMER' },
        undefined as any // TODO: figure out the simulation API
      );

      expect(walkState.value).toEqual({ red: 'walk' });
    });
  });
});
