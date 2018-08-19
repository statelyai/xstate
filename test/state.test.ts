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

describe('State', () => {
  xit('should indicate that it is not changed if initial state', () => {
    assert.ok(machine.initialState.changed);
  });

  it('should indicate that it is not changed if transition is inert', () => {
    assert.isFalse(machine.transition(machine.initialState, 'INERT').changed);
  });
});
