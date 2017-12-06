import { assert } from 'chai';
import { Machine, State } from '../src/index';

describe('history states', () => {
  const historyMachine = Machine({
    key: 'history',
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
    const onSecondState = historyMachine.transition('on', 'SWITCH') as State;
    const offState = historyMachine.transition(onSecondState, 'POWER') as State;

    assert.equal(
      (historyMachine.transition(offState, 'POWER') as State).toString(),
      'on.second'
    );
  });

  it('should go to the initial state when no history present', () => {
    assert.equal(
      (historyMachine.transition('off', 'POWER') as State).toString(),
      'on.first'
    );
  });
});
