import { assert } from 'chai';
import { Machine } from '../src/index';

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
        TO_TWO: 'two'
      }
    },
    two: {}
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
});
