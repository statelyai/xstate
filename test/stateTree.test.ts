import { StateTree } from '../src/StateTree';
import { Machine } from '../src';
import { assert } from 'chai';

const testMachine = Machine({
  initial: 'a',
  states: {
    a: {
      initial: 'one',
      states: {
        one: {},
        two: {
          type: 'final'
        }
      }
    },
    b: {
      type: 'parallel',
      states: {
        one: {
          initial: 'foo',
          states: { foo: {}, bar: { type: 'final' } }
        },
        two: {
          initial: 'foo',
          states: {
            foo: {
              initial: 'x',
              states: {
                x: {}
              }
            },
            bar: { type: 'final' }
          }
        }
      }
    }
  }
});

describe('StateTree', () => {
  it('represents the full value (compound)', () => {
    const st = new StateTree(testMachine, 'a');

    assert.deepEqual(st.stateValue, { a: 'one' });
  });

  it('represents the full value (parallel)', () => {
    const st = new StateTree(testMachine, 'b');

    assert.deepEqual(st.stateValue, {
      b: {
        one: 'foo',
        two: { foo: 'x' }
      }
    });
  });

  xit('represents the full value (parallel deep)', () => {
    const st = new StateTree(testMachine, { b: 'two' });

    assert.deepEqual(st.stateValue, {
      b: {
        one: 'foo',
        two: { foo: 'x' }
      }
    });
  });
});
