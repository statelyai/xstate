import { assert } from 'chai';
import { Machine } from '../src/index';

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
    const onSecondState = historyMachine.transition('on', 'SWITCH');
    const offState = historyMachine.transition(onSecondState, 'POWER');

    assert.equal(
      historyMachine.transition(offState, 'POWER').toString(),
      'on.second'
    );
  });

  it('should go to the initial state when no history present', () => {
    assert.equal(
      historyMachine.transition('off', 'POWER').toString(),
      'on.first'
    );
  });
});

describe('deep history states', () => {
  const historyMachine = Machine({
    key: 'history',
    initial: 'off',
    states: {
      off: {
        on: {
          POWER: 'on.$history',
          DEEP_POWER: 'on.$history.$history',
          DEEPEST_POWER: 'on.$history.$history.$history'
        }
      },
      on: {
        initial: 'first',
        states: {
          first: {
            on: { SWITCH: 'second' }
          },
          second: {
            initial: 'A',
            states: {
              A: {
                on: { INNER: 'B' }
              },
              B: {
                initial: 'P',
                states: {
                  P: {
                    on: { INNER: 'Q' }
                  },
                  Q: {}
                }
              }
            }
          }
        },
        on: {
          POWER: 'off'
        }
      }
    }
  });

  describe('$history', () => {
    // on.first -> on.second.A
    const state2A = historyMachine.transition({ on: 'first' }, 'SWITCH');
    // on.second.A -> on.second.B.P
    const state2BP = historyMachine.transition(state2A, 'INNER');
    // on.second.B.P -> on.second.B.Q
    const state2BQ = historyMachine.transition(state2BP, 'INNER');

    it('should go to the shallow history', () => {
      // on.second.B.P -> off
      const stateOff = historyMachine.transition(state2BP, 'POWER');
      assert.equal(
        historyMachine.transition(stateOff, 'POWER').toString(),
        'on.second.A'
      );
    });
    it('should go to the deep history', () => {
      // on.second.B.P -> off
      const stateOff = historyMachine.transition(state2BP, 'POWER');
      assert.equal(
        historyMachine.transition(stateOff, 'DEEP_POWER').toString(),
        'on.second.B.P'
      );
    });
    it('should go to the deepest history', () => {
      // on.second.B.Q -> off
      const stateOff = historyMachine.transition(state2BQ, 'POWER');
      assert.equal(
        historyMachine.transition(stateOff, 'DEEPEST_POWER').toString(),
        'on.second.B.Q'
      );
    });
    it('can go to the shallow histor even when $history.$history is used', () => {
      const stateOff = historyMachine.transition(state2A, 'POWER');
      assert.equal(
        historyMachine.transition(stateOff, 'DEEPEST_POWER').toString(),
        'on.second.A'
      );
    });
  });
});
