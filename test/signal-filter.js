
import assert from 'assert';
import should from 'should';
import { machine, signalFilter, stateReducer } from '../lib/index';
import isFunction from 'lodash/lang/isFunction';

describe('signalFilter', () => {
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
    let reducer = signalFilter((a) => a, stateReducer(testMachine));

    assert.ok(isFunction(reducer));
    assert.equal(reducer('a', 'T'), 'b');
  });

  it('should filter signals from falsey actions and return original state', () => {
    let reducer = signalFilter((a) => a.valid, stateReducer(testMachine));
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
    let reducer = signalFilter((a) => a.valid)(stateReducer(testMachine));

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
