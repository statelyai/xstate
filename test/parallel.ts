import { assert } from 'chai';
import { Machine } from '../src/index';

describe('parallel states', () => {
  const wordMachine = new Machine({
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
    const initialStates = wordMachine.transition(undefined);

    assert.isArray(initialStates);

    if (Array.isArray(initialStates)) {
      assert.sameMembers(initialStates.map(({ id }) => id), [
        'bold.off',
        'italics.off',
        'underline.off',
        'list.none'
      ]);
    } else {
      throw new Error('not an array');
    }
  });
});
