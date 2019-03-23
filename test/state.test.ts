import { assert } from 'chai';
import { Machine, State } from '../src/index';
import { initEvent, assign } from '../src/actions';

const machine = Machine({
  initial: 'one',
  states: {
    one: {
      onEntry: ['enter'],
      on: {
        EXTERNAL: {
          target: 'one',
          internal: false
        },
        INERT: {
          target: 'one',
          internal: true
        },
        INTERNAL: {
          target: 'one',
          internal: true,
          actions: ['doSomething']
        },
        TO_TWO: 'two',
        TO_THREE: 'three',
        FORBIDDEN_EVENT: undefined
      }
    },
    two: {
      initial: 'deep',
      states: {
        deep: {
          initial: 'foo',
          states: {
            foo: {
              on: {
                FOO_EVENT: 'bar',
                FORBIDDEN_EVENT: undefined
              }
            },
            bar: {
              on: {
                BAR_EVENT: 'foo'
              }
            }
          }
        }
      },
      on: {
        DEEP_EVENT: '.'
      }
    },
    three: {
      type: 'parallel',
      states: {
        first: {
          initial: 'p31',
          states: {
            p31: {
              on: { P31: '.' }
            }
          }
        },
        second: {
          initial: 'p32',
          states: {
            p32: {
              on: { P32: '.' }
            }
          }
        }
      },
      on: {
        THREE_EVENT: '.'
      }
    }
  },
  on: {
    MACHINE_EVENT: '.two'
  }
});

describe('State', () => {
  describe('.changed', () => {
    it('should indicate that it is not changed if initial state', () => {
      assert.isUndefined(machine.initialState.changed);
    });

    it('states from external transitions with onEntry actions should be changed', () => {
      const changedState = machine.transition(machine.initialState, 'EXTERNAL');
      assert.isTrue(changedState.changed, 'changed due to onEntry action');
    });

    it('states from internal transitions with no actions should be unchanged', () => {
      const changedState = machine.transition(machine.initialState, 'EXTERNAL');
      const unchangedState = machine.transition(changedState, 'INERT');
      assert.isFalse(
        unchangedState.changed,
        'unchanged - same state, no actions'
      );
    });

    it('states from internal transitions with actions should be changed', () => {
      const changedState = machine.transition(machine.initialState, 'INTERNAL');
      assert.isTrue(changedState.changed, 'changed - transition actions');
    });

    it('normal state transitions should be changed (initial state)', () => {
      const changedState = machine.transition(machine.initialState, 'TO_TWO');
      assert.isTrue(
        changedState.changed,
        'changed - different state (from initial)'
      );
    });

    it('normal state transitions should be changed', () => {
      const twoState = machine.transition(machine.initialState, 'TO_TWO');
      const changedState = machine.transition(twoState, 'FOO_EVENT');
      assert.isTrue(changedState.changed, 'changed - different state');
    });

    it('normal state transitions with unknown event should be unchanged', () => {
      const twoState = machine.transition(machine.initialState, 'TO_TWO');
      const changedState = machine.transition(twoState, 'UNKNOWN_EVENT');
      assert.isFalse(changedState.changed, 'not changed - unknown event');
    });

    it('should report entering a final state as changed', () => {
      const finalMachine = Machine({
        id: 'final',
        initial: 'one',
        states: {
          one: {
            on: {
              DONE: 'two'
            }
          },

          two: {
            type: 'final'
          }
        }
      });

      const twoState = finalMachine.transition('one', 'DONE');

      assert.isTrue(twoState.changed);
    });

    it('should report any internal transition assignments as changed', () => {
      const assignMachine = Machine({
        id: 'assign',
        initial: 'same',
        context: {
          count: 0
        },
        states: {
          same: {
            on: {
              EVENT: {
                actions: assign({ count: ctx => ctx.count + 1 })
              }
            }
          }
        }
      });

      const { initialState } = assignMachine;
      const changedState = assignMachine.transition(initialState, 'EVENT');
      assert.isTrue(changedState.changed);
      assert.deepEqual(initialState.value, changedState.value);
    });
  });

  describe('.nextEvents', () => {
    it('returns the next possible events for the current state', () => {
      assert.deepEqual(machine.initialState.nextEvents, [
        'EXTERNAL',
        'INERT',
        'INTERNAL',
        'TO_TWO',
        'TO_THREE',
        'MACHINE_EVENT'
      ]);

      assert.deepEqual(
        machine.transition(machine.initialState, 'TO_TWO').nextEvents,
        ['FOO_EVENT', 'DEEP_EVENT', 'MACHINE_EVENT']
      );

      assert.deepEqual(
        machine.transition(machine.initialState, 'TO_THREE').nextEvents,
        ['P31', 'P32', 'THREE_EVENT', 'MACHINE_EVENT']
      );
    });

    it('returns events when transitioned from StateValue', () => {
      const A = machine.transition(machine.initialState, 'TO_THREE');
      const B = machine.transition(A.value, 'TO_THREE');

      assert.deepEqual(B.nextEvents, [
        'P31',
        'P32',
        'THREE_EVENT',
        'MACHINE_EVENT'
      ]);
    });
  });

  describe('State.create()', () => {
    it('should be able to create a state from a JSON config', () => {
      const { initialState } = machine;
      const jsonInitialState = JSON.parse(JSON.stringify(initialState));

      const stateFromConfig = State.create(jsonInitialState);

      assert.deepEqual(machine.transition(stateFromConfig, 'TO_TWO').value, {
        two: { deep: 'foo' }
      });
    });
  });

  describe('State.inert()', () => {
    it('should create an inert instance of the given State', () => {
      const { initialState } = machine;

      assert.isEmpty(State.inert(initialState, undefined).actions);
    });

    it('should create an inert instance of the given stateValue and context', () => {
      const { initialState } = machine;
      const inertState = State.inert(initialState.value, { foo: 'bar' });

      assert.isEmpty(inertState.actions);
      assert.deepEqual(inertState.context, { foo: 'bar' });
    });
  });

  describe('.inert', () => {
    it('should create an inert instance of the current State', () => {
      const { initialState } = machine;

      assert.isEmpty(initialState.inert.actions);
    });
  });

  describe('.event', () => {
    it('the .event prop should be the event (string) that caused the transition', () => {
      const { initialState } = machine;

      const nextState = machine.transition(initialState, 'TO_TWO');

      assert.deepEqual(nextState.event, { type: 'TO_TWO' });
    });

    it('the .event prop should be the event (object) that caused the transition', () => {
      const { initialState } = machine;

      const nextState = machine.transition(initialState, {
        type: 'TO_TWO',
        foo: 'bar'
      });

      assert.deepEqual(nextState.event, { type: 'TO_TWO', foo: 'bar' });
    });

    it('the .event prop should be the initial event for the initial state', () => {
      const { initialState } = machine;

      assert.deepEqual(initialState.event, initEvent);
    });
  });
});
