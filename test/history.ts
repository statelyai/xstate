import { assert } from 'chai';
import { Machine } from '../src/index';

describe('history states', () => {
  const historyMachine = new Machine({
    id: 'history',
    initial: 'off',
    states: {
      off: {
        on: { POWER: 'on.$history' }
      },
      on: {
        initial: 'first',
        states: {
          first: {
            on: { SWITCH: 'second' }
          },
          second: {
            on: { SWITCH: 'third' }
          },
          third: {}
        },
        on: {
          POWER: 'off'
        }
      }
    }
  });

  it('should go to the most recently visited state', () => {
    const onSecondState = historyMachine.transition('on', 'SWITCH');
    const offState = historyMachine.transition(onSecondState, 'POWER');

    console.log('----------');
    assert.equal(
      historyMachine.transition(offState, 'POWER').value,
      'on.second'
    );
  });

  it('should go to the initial state when no history present', () => {
    assert.equal(historyMachine.transition('off', 'POWER').value, 'on.first');
  });
});
