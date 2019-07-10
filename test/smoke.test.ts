import { assert } from 'chai';
import { Machine } from '../lib';

describe('smoke test', () => {
  it('should work with built files', () => {
    assert.doesNotThrow(() => {
      return Machine({
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
    });
  });
});
