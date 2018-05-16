import { Machine } from '../src/index';
import { assert } from 'chai';

describe('transient states (eventless transitions)', () => {
  const updateMachine = Machine({
    initial: 'G',
    parallel: false,
    states: {
      G: {
        on: { UPDATE_BUTTON_CLICKED: 'E' }
      },
      E: {
        on: {
          // eventless transition
          '': [
            { target: 'D', cond: ({ data }) => !data }, // no data returned
            { target: 'B', cond: ({ status }) => status === 'Y' },
            { target: 'C', cond: ({ status }) => status === 'X' },
            { target: 'F' } // default, or just the string 'F'
          ]
        }
      },
      D: {},
      B: {},
      C: {},
      F: {}
    }
  });

  it('should choose the first candidate target that matches the cond (D)', () => {
    const nextState = updateMachine.transition('G', 'UPDATE_BUTTON_CLICKED', {
      data: false
    });
    assert.equal(nextState.value, 'D');
  });

  it('should choose the first candidate target that matches the cond (B)', () => {
    const nextState = updateMachine.transition('G', 'UPDATE_BUTTON_CLICKED', {
      data: true,
      status: 'Y'
    });
    assert.equal(nextState.value, 'B');
  });

  it('should choose the first candidate target that matches the cond (C)', () => {
    const nextState = updateMachine.transition('G', 'UPDATE_BUTTON_CLICKED', {
      data: true,
      status: 'X'
    });
    assert.equal(nextState.value, 'C');
  });

  it('should choose the final candidate without a cond if none others match', () => {
    const nextState = updateMachine.transition('G', 'UPDATE_BUTTON_CLICKED', {
      data: true,
      status: 'other'
    });
    assert.equal(nextState.value, 'F');
  });

  it('should carry actions from previous transitions within same step', () => {
    const machine = Machine({
      initial: 'A',
      states: {
        A: {
          onExit: 'exit_A',
          on: {
            TIMER: {
              T: { actions: ['timer'] }
            }
          }
        },
        T: {
          on: {
            '': [{ target: 'B' }]
          }
        },
        B: {
          onEntry: 'enter_B'
        }
      }
    });

    const state = machine.transition('A', 'TIMER');

    assert.deepEqual(state.actions, ['exit_A', 'timer', 'enter_B']);
  });
});
