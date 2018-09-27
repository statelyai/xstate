import { assert } from 'chai';
import { Machine } from '../src/index';
import { after, cancel, send } from '../src/actions';

const lightMachine = Machine({
  id: 'light',
  initial: 'green',
  context: {
    canTurnGreen: true
  },
  states: {
    green: {
      after: {
        1000: 'yellow'
      }
    },
    yellow: {
      after: {
        1000: [{ target: 'red' }]
      }
    },
    red: {
      after: [{ delay: 1000, target: 'green' }]
    }
  }
});

describe('delayed transitions', () => {
  it('should resolve transitions', () => {
    assert.deepEqual(lightMachine.states.green.after, [
      {
        target: 'yellow',
        delay: 1000,
        event: after(1000, 'light.green'),
        actions: []
      }
    ]);
    assert.deepEqual(lightMachine.states.yellow.after, [
      {
        target: 'red',
        delay: 1000,
        event: after(1000, 'light.yellow'),
        actions: []
      }
    ]);
    assert.deepEqual(lightMachine.states.red.after, [
      {
        target: 'green',
        delay: 1000,
        event: after(1000, 'light.red'),
        actions: []
      }
    ]);
  });

  it('should transition after delay', () => {
    const nextState = lightMachine.transition(
      lightMachine.initialState,
      after(1000, 'light.green')
    );

    assert.deepEqual(nextState.value, 'yellow');
    assert.deepEqual(nextState.actions, [
      cancel(after(1000, 'light.green')),
      send(after(1000, 'light.yellow'), { delay: 1000 })
    ]);
  });
});
