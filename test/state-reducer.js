
import assert from 'assert';
import should from 'should';
import { machine, stateReducer } from '../lib/index';

describe('stateReducer', () => {
  let testMachine = machine({
    states: [
      {
        id: 'a',
        initial: true,
        transitions: [
          {
            event: 'T',
            target: 'b'
          }
        ]
      },
      {
        id: 'b'
      }
    ]
  });

  it('should create a function that reduces a state and action of a machine to a state', () => {
    let reducer = stateReducer(testMachine);

    assert.equal(reducer('a', 'T'), 'b');
  });

  it('should transition to the initial state with falsey signal', () => {
    let reducer = stateReducer(testMachine);

    assert.equal(
      reducer(),
      'a');
  });

  it('should transition to the same state from invalid signals', () => {
    let reducer = stateReducer(testMachine);

    assert.equal(
      reducer('a', false),
      'a');

    assert.equal(
      reducer('a', 'FAKE'),
      'a');
  });
});
