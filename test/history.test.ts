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
    xit(
      'can go to the shallow history even when $history.$history is used',
      () => {
        const stateOff = historyMachine.transition(state2A, 'POWER');
        assert.equal(
          historyMachine.transition(stateOff, 'DEEPEST_POWER').toString(),
          'on.second.A'
        );
      }
    );
  });
});

describe('parallel history states', () => {
  const historyMachine = Machine({
    key: 'parallelhistory',
    initial: 'off',
    states: {
      off: {
        on: {
          SWITCH: 'on', // go to the initial states
          POWER: 'on.$history',
          DEEP_POWER: 'on.$history.$history',
          DEEPEST_POWER: 'on.$history.$history.$history',
          PARALLEL_HISTORY: [{ target: ['on.A.$history', 'on.K.$history'] }],
          PARALLEL_SOME_HISTORY: [{ target: ['on.A.C', 'on.K.$history'] }],
          PARALLEL_DEEP_HISTORY: [
            { target: ['on.A.$history.$history', 'on.K.$history.$history'] }
          ]
        }
      },
      on: {
        parallel: true,
        states: {
          A: {
            initial: 'B',
            states: {
              B: {
                on: { INNER_A: 'C' }
              },
              C: {
                initial: 'D',
                states: {
                  D: {
                    on: { INNER_A: 'E' }
                  },
                  E: {}
                }
              }
            }
          },
          K: {
            initial: 'L',
            states: {
              L: {
                on: { INNER_K: 'M' }
              },
              M: {
                initial: 'N',
                states: {
                  N: {
                    on: { INNER_K: 'O' }
                  },
                  O: {}
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
    const stateABKL = historyMachine.transition(
      historyMachine.initialState,
      'SWITCH'
    );
    // INNER_A twice
    const stateACDKL = historyMachine.transition(stateABKL, 'INNER_A');
    const stateACEKL = historyMachine.transition(stateACDKL, 'INNER_A');

    // INNER_K twice
    const stateACEKMN = historyMachine.transition(stateACEKL, 'INNER_K');
    const stateACEKMO = historyMachine.transition(stateACEKMN, 'INNER_K');

    it('should ignore parallel state history', () => {
      const stateOff = historyMachine.transition(stateACDKL, 'POWER');
      assert.deepEqual(historyMachine.transition(stateOff, 'POWER').value, {
        on: { A: 'B', K: 'L' }
      });
    });

    it('should remember first level state history', () => {
      const stateOff = historyMachine.transition(stateACDKL, 'POWER');
      assert.deepEqual(
        historyMachine.transition(stateOff, 'DEEP_POWER').value,
        {
          on: { A: { C: 'D' }, K: 'L' }
        }
      );
    });

    xit('should remember second level state history', () => {
      const stateOff = historyMachine.transition(stateACDKL, 'POWER');
      assert.deepEqual(
        historyMachine.transition(stateOff, 'DEEPEST_POWER').value,
        {
          on: { A: { C: 'D' }, K: 'L' }
        }
      );
    });

    xit(
      'should remember second level state history, ignoring too many levels of $history',
      () => {
        const stateOff = historyMachine.transition(stateACDKL, 'POWER');
        assert.deepEqual(
          historyMachine.transition(stateOff, 'DEEPEST_POWER').value,
          {
            on: { A: { C: 'D' }, K: 'L' }
          }
        );
      }
    );

    xit('should remember three levels of state history', () => {
      const stateOff = historyMachine.transition(stateACEKL, 'POWER');
      assert.deepEqual(
        historyMachine.transition(stateOff, 'DEEPEST_POWER').value,
        {
          on: { A: { C: 'E' }, K: 'L' }
        }
      );
    });

    it('should re-enter each regions of parallel state correctly', () => {
      const stateOff = historyMachine.transition(stateACEKMO, 'POWER');
      assert.deepEqual(
        historyMachine.transition(stateOff, 'DEEP_POWER').value,
        {
          on: { A: { C: 'D' }, K: { M: 'N' } }
        }
      );
    });

    it('should retain all regions of parallel state', () => {
      const stateOff = historyMachine.transition(stateACEKMO, 'POWER');
      assert.deepEqual(
        historyMachine.transition(stateOff, 'DEEPEST_POWER').value,
        {
          on: { A: { C: 'E' }, K: { M: 'O' } }
        }
      );
    });

    it('should re-enter multiple history states', () => {
      const stateOff = historyMachine.transition(stateACEKMO, 'POWER');
      assert.deepEqual(
        historyMachine.transition(stateOff, 'PARALLEL_HISTORY').value,
        {
          on: { A: { C: 'D' }, K: { M: 'N' } }
        }
      );
    });

    it('should re-enter a parallel with partial history', () => {
      const stateOff = historyMachine.transition(stateACEKMO, 'POWER');
      assert.deepEqual(
        historyMachine.transition(stateOff, 'PARALLEL_SOME_HISTORY').value,
        {
          on: { A: { C: 'D' }, K: { M: 'N' } }
        }
      );
    });

    it('should re-enter a parallel with full history', () => {
      const stateOff = historyMachine.transition(stateACEKMO, 'POWER');
      assert.deepEqual(
        historyMachine.transition(stateOff, 'PARALLEL_DEEP_HISTORY').value,
        {
          on: { A: { C: 'E' }, K: { M: 'O' } }
        }
      );
    });
  });
});
