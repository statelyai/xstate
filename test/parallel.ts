import { assert } from 'chai';
import { Machine } from '../src/index';
import { testMultiTransition } from './utils';

describe('parallel states', () => {
  const wordMachine = Machine({
    parallel: true,
    states: {
      bold: {
        initial: 'off',
        states: {
          on: {
            on: { TOGGLE_BOLD: 'off' }
          },
          off: {
            on: { TOGGLE_BOLD: 'on' }
          }
        }
      },
      underline: {
        initial: 'off',
        states: {
          on: {
            on: { TOGGLE_UNDERLINE: 'off' }
          },
          off: {
            on: { TOGGLE_UNDERLINE: 'on' }
          }
        }
      },
      italics: {
        initial: 'off',
        states: {
          on: {
            on: { TOGGLE_ITALICS: 'off' }
          },
          off: {
            on: { TOGGLE_ITALICS: 'on' }
          }
        }
      },
      list: {
        initial: 'none',
        states: {
          none: {
            on: { BULLETS: 'bullets', NUMBERS: 'numbers' }
          },
          bullets: {
            on: { NONE: 'none', NUMBERS: 'numbers' }
          },
          numbers: {
            on: { BULLETS: 'bullets', NONE: 'none' }
          }
        }
      }
    }
  });

  it('should have initial parallel states', () => {
    const initialState = wordMachine.transition(undefined);

    assert.deepEqual(initialState.value, {
      bold: 'off',
      italics: 'off',
      underline: 'off',
      list: 'none'
    });
  });

  const expected = {
    'bold.off': {
      TOGGLE_BOLD: {
        bold: 'on',
        italics: 'off',
        underline: 'off',
        list: 'none'
      }
    },
    'bold.on': {
      TOGGLE_BOLD: {
        bold: 'off',
        italics: 'off',
        underline: 'off',
        list: 'none'
      }
    },
    [JSON.stringify({
      bold: 'off',
      italics: 'off',
      underline: 'on',
      list: 'bullets'
    })]: {
      'TOGGLE_BOLD, TOGGLE_ITALICS': {
        bold: 'on',
        italics: 'on',
        underline: 'on',
        list: 'bullets'
      }
    }
  };

  Object.keys(expected).forEach(fromState => {
    Object.keys(expected[fromState]).forEach(actionTypes => {
      const toState = expected[fromState][actionTypes];

      it(`should go from ${fromState} to ${JSON.stringify(
        toState
      )} on ${actionTypes}`, () => {
        const resultState = testMultiTransition(
          wordMachine,
          fromState,
          actionTypes
        );

        assert.deepEqual(resultState.value, toState);
      });
    });
  });
});
