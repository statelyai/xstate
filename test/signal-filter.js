
import assert from 'assert';
import { machine, actionFilter, stateReducer } from '../lib/index';
import isFunction from 'lodash/lang/isFunction';

describe('actionFilter', () => {
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

  it('should return a reducer', () => {
    let reducer = actionFilter((a) => a, stateReducer(testMachine));

    assert.ok(isFunction(reducer));
    assert.equal(reducer('a', 'T'), 'b');
  });

  it('should filter actions from falsey actions and return original state', () => {
    let reducer = actionFilter((a) => a.valid, stateReducer(testMachine));
    let validAction = {
      type: 'T',
      valid: true
    };

    let invalidAction = {
      type: 'T',
      valid: false
    };

    assert.equal(
      reducer('a', validAction),
      'b');

    assert.equal(
      reducer('a', invalidAction),
      'a');
  });

  it('should be able to be curried', () => {
    let reducer = actionFilter((a) => a.valid)(stateReducer(testMachine));

    let validAction = {
      type: 'T',
      valid: true
    };

    let invalidAction = {
      type: 'T',
      valid: false
    };

    assert.equal(
      reducer('a', validAction),
      'b');

    assert.equal(
      reducer('a', invalidAction),
      'a');
  });
});
