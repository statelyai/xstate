
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

  // it('should filter signals from falsey actions and return original state', () => {
  //   let reducer = stateReducer(testMachine, (a) => a.valid && a);
  //   let validAction = {
  //     type: 'T',
  //     valid: true
  //   };

  //   let invalidAction = {
  //     type: 'T',
  //     valid: false
  //   };

  //   assert.equal(
  //     reducer('a', validAction),
  //     'b');

  //   assert.equal(
  //     reducer('a', invalidAction),
  //     'a');
  // });

  it('should transition to the initial state with falsey state and signal', () => {
    let reducer = stateReducer(testMachine);

    assert.equal(
      reducer(),
      'a');

    assert.equal(
      reducer(false),
      'a');
  });
});
