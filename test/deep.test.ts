import { assert } from 'chai';
import { Machine } from '../src/index';

describe('deep transitions', () => {
  const deepMachine = Machine({
    key: 'deep',
    initial: 'A',
    parallel: false,
    on: {
      MACHINE_EVENT: '#DONE'
    },
    states: {
      DONE: {},
      FAIL: {},
      A: {
        on: {
          A_EVENT: '#deep.DONE',
          B_EVENT: 'FAIL' // shielded by B's B_EVENT
        },
        onExit: 'EXIT_A',
        initial: 'B',
        states: {
          B: {
            on: {
              B_EVENT: '#deep.DONE'
            },
            onExit: 'EXIT_B',
            initial: 'C',
            states: {
              C: {
                on: {
                  C_EVENT: '#deep.DONE'
                },
                onExit: 'EXIT_C',
                initial: 'D',
                states: {
                  D: {
                    on: {
                      D_EVENT: '#deep.DONE'
                    },
                    onExit: 'EXIT_D'
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  describe('exiting super/substates', () => {
    it('should exit all substates when superstates exits (A_EVENT)', () => {
      const actual = deepMachine.transition(deepMachine.initialState, 'A_EVENT')
        .actions;
      const expected = ['EXIT_D', 'EXIT_C', 'EXIT_B', 'EXIT_A'];
      assert.deepEqual(actual, expected);
    });

    it('should exit substates and superstates when exiting (B_EVENT)', () => {
      const actual = deepMachine.transition(deepMachine.initialState, 'B_EVENT')
        .actions;
      const expected = ['EXIT_D', 'EXIT_C', 'EXIT_B', 'EXIT_A'];
      assert.deepEqual(actual, expected);
    });

    it('should exit substates and superstates when exiting (C_EVENT)', () => {
      const actual = deepMachine.transition(deepMachine.initialState, 'C_EVENT')
        .actions;
      const expected = ['EXIT_D', 'EXIT_C', 'EXIT_B', 'EXIT_A'];
      assert.deepEqual(actual, expected);
    });

    it('should exit superstates when exiting (D_EVENT)', () => {
      const actual = deepMachine.transition(deepMachine.initialState, 'D_EVENT')
        .actions;
      const expected = ['EXIT_D', 'EXIT_C', 'EXIT_B', 'EXIT_A'];
      assert.deepEqual(actual, expected);
    });

    it('should exit substate when machine handles event (MACHINE_EVENT)', () => {
      const actual = deepMachine.transition(
        deepMachine.initialState,
        'MACHINE_EVENT'
      ).actions;
      const expected = ['EXIT_D', 'EXIT_C', 'EXIT_B', 'EXIT_A'];
      assert.deepEqual(actual, expected);
    });
  });
});
