import { assert } from 'chai';
import { Machine } from '../src/index';

const machine = Machine({
  initial: 'one',
  states: {
    one: {
      onEntry: ['enter'],
      on: {
        INERT: undefined
      }
    }
  }
});

xdescribe('State', () => {
  it('should indicate that it is not changed if initial state', () => {
    assert.ok(machine.initialState.changed);
  });

  it('should indicate that it is not changed if transition is inert', () => {
    const changedState = machine.transition(machine.initialState, 'INERT');
    const unchangedState = machine.transition(changedState, 'INERT');
    assert.isFalse(changedState.changed, 'changed due to onEntry action');
    assert.isTrue(unchangedState.changed, 'unchanged - same state, no actions');
  });
});
