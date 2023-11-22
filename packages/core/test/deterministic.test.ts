import { fromCallback, createActor } from '../src/index.ts';
import { createMachine } from '../src/createMachine.ts';

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
      const actorScope = null as any; // TODO: figure out the simulation API
      expect(
        lightMachine.transition(
          lightMachine.resolveState({ value: 'green' }),
          {
            type: 'TIMER'
          },
          actorScope
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
      const actorScope = null as any; // TODO: figure out the simulation API
      expect(() =>
        lightMachine.transition(
          testMachine.resolveState({ value: 'red' }),
          undefined as any,
          actorScope
        )
      ).toThrow();
    });

    it('should transition to nested states as target', () => {
      const actorScope = null as any; // TODO: figure out the simulation API
      expect(
        testMachine.transition(
          testMachine.resolveState({ value: 'a' }),
          { type: 'T' },
          actorScope
        ).value
      ).toEqual({
        b: 'b1'
      });
    });

    it('should throw an error for transitions from invalid states', () => {
      const actorScope = null as any; // TODO: figure out the simulation API
      expect(() =>
        testMachine.transition(
          testMachine.resolveState({ value: 'fake' }),
          { type: 'T' },
          actorScope
        )
      ).toThrow();
    });

    it('should throw an error for transitions from invalid substates', () => {
      const actorScope = null as any; // TODO: figure out the simulation API
      expect(() =>
        testMachine.transition(
          testMachine.resolveState({ value: 'a.fake' }),
          {
            type: 'T'
          },
          actorScope
        )
      ).toThrow();
    });

    it('should use the machine.initialState when an undefined state is given', () => {
      const actorScope = null as any; // TODO: figure out the simulation API
      expect(
        lightMachine.transition(
          lightMachine.getInitialState(actorScope),
          { type: 'TIMER' },
          actorScope
        ).value
      ).toEqual('yellow');
    });

    it('should use the machine.initialState when an undefined state is given (unhandled event)', () => {
      const actorScope = null as any; // TODO: figure out the simulation API
      expect(
        lightMachine.transition(
          lightMachine.getInitialState(actorScope),
          { type: 'TIMER' },
          actorScope
        ).value
      ).toEqual('yellow');
    });
  });

  // TODO: figure out the simulation API
  describe('machine.transition() with nested states', () => {
    it('should properly transition a nested state', () => {
      const actorScope = null as any; // TODO: figure out the simulation API
      expect(
        lightMachine.transition(
          lightMachine.resolveState({ value: { red: 'walk' } }),
          { type: 'PED_COUNTDOWN' },
          actorScope
        ).value
      ).toEqual({ red: 'wait' });
    });

    it('should transition from initial nested states', () => {
      const actorScope = null as any; // TODO: figure out the simulation API
      expect(
        lightMachine.transition(
          lightMachine.resolveState({ value: 'red' }),
          {
            type: 'PED_COUNTDOWN'
          },
          actorScope
        ).value
      ).toEqual({
        red: 'wait'
      });
    });

    it('should transition from deep initial nested states', () => {
      const actorScope = null as any; // TODO: figure out the simulation API
      expect(
        lightMachine.transition(
          lightMachine.resolveState({ value: 'red' }),
          {
            type: 'PED_COUNTDOWN'
          },
          actorScope
        ).value
      ).toEqual({
        red: 'wait'
      });
    });

    it('should bubble up events that nested states cannot handle', () => {
      const actorScope = null as any; // TODO: figure out the simulation API
      expect(
        lightMachine.transition(
          lightMachine.resolveState({ value: { red: 'stop' } }),
          { type: 'TIMER' },
          actorScope
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
      const actorScope = null as any; // TODO: figure out the simulation API
      expect(
        lightMachine.transition(
          lightMachine.resolveState({ value: 'yellow' }),
          {
            type: 'TIMER'
          },
          actorScope
        ).value
      ).toEqual({
        red: 'walk'
      });
    });

    it('should return the same state if no transition occurs', () => {
      const actorScope = null as any; // TODO: figure out the simulation API
      const initialState = lightMachine.transition(
        lightMachine.getInitialState(actorScope),
        {
          type: 'NOTHING'
        },
        actorScope
      );
      const nextState = lightMachine.transition(
        initialState,
        {
          type: 'NOTHING'
        },
        actorScope
      );

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
      const actorScope = null as any; // TODO: figure out the simulation API
      expect(
        machine.transition(
          machine.getInitialState(actorScope),
          { type: 'NEXT' },
          actorScope
        ).value
      ).toEqual('test');
    });
  });

  describe('forbidden events', () => {
    it('undefined transitions should forbid events', () => {
      const actorScope = null as any; // TODO: figure out the simulation API

      const walkState = lightMachine.transition(
        lightMachine.resolveState({ value: { red: 'walk' } }),
        { type: 'TIMER' },
        actorScope
      );

      expect(walkState.value).toEqual({ red: 'walk' });
    });
  });
});
