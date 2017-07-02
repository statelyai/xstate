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
            on: { TOGGLE: 'off' }
          },
          off: {
            on: { TOGGLE: 'on' }
          }
        }
      },
      underline: {
        initial: 'off',
        states: {
          on: {
            on: { TOGGLE: 'off' }
          },
          off: {
            on: { TOGGLE: 'on' }
          }
        }
      },
      italics: {
        initial: 'off',
        states: {
          on: {
            on: { TOGGLE: 'off' }
          },
          off: {
            on: { TOGGLE: 'on' }
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
});
