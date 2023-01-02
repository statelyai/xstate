import { createMachine } from '../src/Machine';

describe('deterministic machine', () => {
  const pedestrianStates = {
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
  };

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
        ...pedestrianStates
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

  const deepMachine = createMachine({
    initial: 'a',
    states: {
      a1: {
        initial: 'a2',
        states: {
          a2: {
            initial: 'a3',
            states: {
              a3: {
                initial: 'a4',
                states: {
                  a4: {}
                }
              }
            }
          }
        }
      }
    }
  });

  describe('machine.initialState', () => {
    it('should return the initial state value', () => {
      expect(lightMachine.initialState.value).toEqual('green');
    });
  });

  describe('machine.transition()', () => {
    it('should properly transition states based on string event', () => {
      expect(lightMachine.transition('green', { type: 'TIMER' }).value).toEqual(
        'yellow'
      );
    });

    it('should properly transition states based on event-like object', () => {
      const event = {
        type: 'TIMER'
      };

      expect(lightMachine.transition('green', event).value).toEqual('yellow');
    });

    it('should not transition states for illegal transitions', () => {
      expect(lightMachine.transition('green', { type: 'FAKE' }).value).toEqual(
        'green'
      );
      expect(
        lightMachine.transition('green', { type: 'FAKE' }).actions
      ).toHaveLength(0);
    });

    it('should throw an error if not given an event', () => {
      expect(() => lightMachine.transition('red', undefined as any)).toThrow();
    });

    it('should transition to nested states as target', () => {
      expect(testMachine.transition('a', { type: 'T' }).value).toEqual({
        b: 'b1'
      });
    });

    it('should throw an error for transitions from invalid states', () => {
      expect(() => testMachine.transition('fake', { type: 'T' })).toThrow();
    });

    it('should throw an error for transitions from invalid substates', () => {
      expect(() => testMachine.transition('a.fake', { type: 'T' })).toThrow();
    });

    it('should use the machine.initialState when an undefined state is given', () => {
      expect(
        lightMachine.transition(undefined, { type: 'TIMER' }).value
      ).toEqual('yellow');
    });

    it('should use the machine.initialState when an undefined state is given (unhandled event)', () => {
      expect(
        lightMachine.transition(undefined, { type: 'TIMER' }).value
      ).toEqual('yellow');
    });
  });

  describe('machine.transition() with nested states', () => {
    it('should properly transition a nested state', () => {
      expect(
        lightMachine.transition({ red: 'walk' }, { type: 'PED_COUNTDOWN' })
          .value
      ).toEqual({ red: 'wait' });
    });

    it('should transition from initial nested states', () => {
      expect(
        lightMachine.transition('red', { type: 'PED_COUNTDOWN' }).value
      ).toEqual({
        red: 'wait'
      });
    });

    it('should transition from deep initial nested states', () => {
      expect(
        lightMachine.transition('red', { type: 'PED_COUNTDOWN' }).value
      ).toEqual({
        red: 'wait'
      });
    });

    it('should bubble up events that nested states cannot handle', () => {
      expect(
        lightMachine.transition({ red: 'stop' }, { type: 'TIMER' }).value
      ).toEqual('green');
    });

    it('should not transition from illegal events', () => {
      expect(
        lightMachine.transition({ red: 'walk' }, { type: 'FAKE' }).value
      ).toEqual({
        red: 'walk'
      });
      expect(
        lightMachine.transition({ red: 'walk' }, { type: 'FAKE' }).actions
      ).toHaveLength(0);

      expect(deepMachine.transition('a1', { type: 'FAKE' }).value).toEqual({
        a1: { a2: { a3: 'a4' } }
      });
      expect(
        deepMachine.transition('a1', { type: 'FAKE' }).actions
      ).toHaveLength(0);
    });

    it('should transition to the deepest initial state', () => {
      expect(
        lightMachine.transition('yellow', { type: 'TIMER' }).value
      ).toEqual({
        red: 'walk'
      });
    });

    it('should return the equivalent state if no transition occurs', () => {
      const initialState = lightMachine.transition(lightMachine.initialState, {
        type: 'NOTHING'
      });
      const nextState = lightMachine.transition(initialState, {
        type: 'NOTHING'
      });

      expect(initialState.value).toEqual(nextState.value);
      expect(nextState.changed).toBe(false);
    });
  });

  describe('machine.transition() with array `.on` configs', () => {
    it('should properly transition based on an event', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: [{ event: 'NEXT', target: 'pass' }]
          },
          pass: {}
        }
      });
      expect(machine.transition('a', { type: 'NEXT' }).value).toBe('pass');
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
        machine.transition(machine.initialState, { type: 'NEXT' }).value
      ).toEqual('test');
    });
  });

  describe('forbidden events', () => {
    it('undefined transitions should forbid events', () => {
      const walkState = lightMachine.transition(
        { red: 'walk' },
        { type: 'TIMER' }
      );

      expect(walkState.value).toEqual({ red: 'walk' });
    });
  });
});
