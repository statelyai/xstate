import { assert } from 'chai';
import { Machine, State } from '../src/index';

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

  it('normal state transitions should be changed', () => {
    const changedState = machine.transition(machine.initialState, 'TO_TWO');
    assert.isTrue(changedState.changed, 'changed - different state');
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
});
