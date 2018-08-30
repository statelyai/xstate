import { assert } from 'chai';
import { Machine } from '../src/index';

const lightMachine = Machine({
  initial: 'green',
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

describe('delayed transitions', () => {
  it('should resolve transitions', () => {
    assert.deepEqual(lightMachine.states.green.after, [
      { target: 'yellow', delay: 1000, event: `after(1000)` }
    ]);
    assert.deepEqual(lightMachine.states.yellow.after, [
      { target: 'red', delay: 1000, event: `after(1000)` }
    ]);
    assert.deepEqual(lightMachine.states.red.after, [
      { target: 'green', delay: 1000, event: `after(1000)` }
    ]);
  });
});
