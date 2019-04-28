import { FSM } from '../src';
import { assert } from 'chai';

describe('@xstate/fsm', () => {
  const lightFSM = FSM({
    initial: 'green',
    states: {
      green: {
        entry: 'enterGreen',
        exit: 'exitGreen',
        on: {
          TIMER: {
            target: 'yellow',
            actions: ['g-y 1', 'g-y 2']
          }
        }
      },
      yellow: {}
    }
  });
  it('should have the correct initial state', () => {
    const { initialState } = lightFSM;

    assert.deepEqual(initialState.value, 'green');
    assert.deepEqual(initialState.actions, ['enterGreen']);
  });
  it('should transition correctly', () => {
    const nextState = lightFSM.transition('green', 'TIMER');
    assert.deepEqual(nextState.value, 'yellow');
    assert.deepEqual(nextState.actions, ['exitGreen', 'g-y 1', 'g-y 2']);
  });

  it('should stay on the same state for undefined transitions', () => {
    const nextState = lightFSM.transition('green', 'FAKE');
    assert.deepEqual(nextState.value, 'green');
    assert.deepEqual(nextState.actions, []);
  });
});
