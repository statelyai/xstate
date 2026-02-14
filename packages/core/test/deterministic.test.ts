import {
  fromCallback,
  createActor,
  transition,
  createMachine,
  getInitialSnapshot
} from '../src/index.ts';

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
        transition(
          lightMachine,
          lightMachine.resolveState({ value: 'green' }),
          {
            type: 'TIMER'
          }
        )[0].value
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

      // First send of FAKE event - snapshot changes because event is different from init
      actor.send({ type: 'FAKE' });
      const snapshotAfterFirstFake = actor.getSnapshot();

      expect(snapshotAfterFirstFake.value).toBe('a');
      expect(snapshotAfterFirstFake.event).toEqual({ type: 'FAKE' });

      // Second send of structurally equal FAKE event - snapshot should be same reference
      // due to structural sharing (no transition + same event = same snapshot)
      actor.send({ type: 'FAKE' });

      expect(actor.getSnapshot().value).toBe('a');
      expect(actor.getSnapshot()).toBe(snapshotAfterFirstFake);
    });

    it('should throw an error if not given an event', () => {
      expect(() =>
        transition(
          lightMachine,
          testMachine.resolveState({ value: 'red' }),
          undefined as any
        )
      ).toThrow();
    });

    it('should transition to nested states as target', () => {
      expect(
        transition(testMachine, testMachine.resolveState({ value: 'a' }), {
          type: 'T'
        })[0].value
      ).toEqual({
        b: 'b1'
      });
    });

    it('should throw an error for transitions from invalid states', () => {
      expect(() =>
        transition(testMachine, testMachine.resolveState({ value: 'fake' }), {
          type: 'T'
        })
      ).toThrow();
    });

    it('should throw an error for transitions from invalid substates', () => {
      expect(() =>
        transition(testMachine, testMachine.resolveState({ value: 'a.fake' }), {
          type: 'T'
        })
      ).toThrow();
    });

    it('should use the machine.initialState when an undefined state is given', () => {
      const init = getInitialSnapshot(lightMachine, undefined);
      expect(
        transition(lightMachine, init, { type: 'TIMER' })[0].value
      ).toEqual('yellow');
    });

    it('should use the machine.initialState when an undefined state is given (unhandled event)', () => {
      const init = getInitialSnapshot(lightMachine, undefined);
      expect(
        transition(lightMachine, init, { type: 'TIMER' })[0].value
      ).toEqual('yellow');
    });
  });

  describe('machine transition with nested states', () => {
    it('should properly transition a nested state', () => {
      expect(
        transition(
          lightMachine,
          lightMachine.resolveState({ value: { red: 'walk' } }),
          { type: 'PED_COUNTDOWN' }
        )[0].value
      ).toEqual({ red: 'wait' });
    });

    it('should transition from initial nested states', () => {
      expect(
        transition(lightMachine, lightMachine.resolveState({ value: 'red' }), {
          type: 'PED_COUNTDOWN'
        })[0].value
      ).toEqual({
        red: 'wait'
      });
    });

    it('should transition from deep initial nested states', () => {
      expect(
        transition(lightMachine, lightMachine.resolveState({ value: 'red' }), {
          type: 'PED_COUNTDOWN'
        })[0].value
      ).toEqual({
        red: 'wait'
      });
    });

    it('should bubble up events that nested states cannot handle', () => {
      expect(
        transition(
          lightMachine,
          lightMachine.resolveState({ value: { red: 'stop' } }),
          { type: 'TIMER' }
        )[0].value
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

      // First FAKE event changes snapshot (different from init event)
      actor.send({ type: 'FAKE' });
      const snapshotAfterFirstFake = actor.getSnapshot();

      expect(snapshotAfterFirstFake.value).toEqual({ a: 'b' });
      expect(snapshotAfterFirstFake.event).toEqual({ type: 'FAKE' });

      // Second structurally equal FAKE event - snapshot should be same reference
      actor.send({ type: 'FAKE' });

      expect(actor.getSnapshot().value).toEqual({ a: 'b' });
      expect(actor.getSnapshot()).toBe(snapshotAfterFirstFake);
    });

    it('should transition to the deepest initial state', () => {
      expect(
        transition(
          lightMachine,
          lightMachine.resolveState({ value: 'yellow' }),
          {
            type: 'TIMER'
          }
        )[0].value
      ).toEqual({
        red: 'walk'
      });
    });

    it('should return the same snapshot if no transition occurs and event is structurally equal', () => {
      const init = getInitialSnapshot(lightMachine, undefined);
      // First NOTHING event - snapshot changes (different from init event)
      const [stateAfterFirstNothing] = transition(lightMachine, init, {
        type: 'NOTHING'
      });
      // Second structurally equal NOTHING event - snapshot should be same reference
      const [stateAfterSecondNothing] = transition(
        lightMachine,
        stateAfterFirstNothing,
        {
          type: 'NOTHING'
        }
      );

      expect(stateAfterFirstNothing.value).toEqual(
        stateAfterSecondNothing.value
      );
      expect(stateAfterSecondNothing.event).toEqual({ type: 'NOTHING' });
      // Structural sharing: same event + no transition = same snapshot reference
      expect(stateAfterSecondNothing).toBe(stateAfterFirstNothing);
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
      expect(transition(machine, init, { type: 'NEXT' })[0].value).toEqual(
        'test'
      );
    });
  });

  describe('forbidden events', () => {
    it('undefined transitions should forbid events', () => {
      const [walkState] = transition(
        lightMachine,
        lightMachine.resolveState({ value: { red: 'walk' } }),
        { type: 'TIMER' }
      );

      expect(walkState.value).toEqual({ red: 'walk' });
    });
  });
});
