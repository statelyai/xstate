
import assert from 'assert';
import should from 'should';
import { machine, stateReducer } from '../dist/index';

describe('stateReducer', () => {
  let testMachine = machine({
    states: [
      {
        id: 'a',
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
    let reducer = stateReducer(testMachine, (a) => a);

    assert.equal(reducer('a', 'T'), 'b');
  });

  it('should be able to be curried', () => {
    let createTestReducer = stateReducer(testMachine);

    assert.equal(createTestReducer((x) => x)('a', 'T'), 'b');
  });

  it('should map signals from actions', () => {
    let reducer = stateReducer(testMachine, (a) => a.foo);

    assert.equal(
      reducer('a', {foo: 'T'}),
      'b');
  });

  it('should filter signals from falsey actions and return original state', () => {
    let reducer = stateReducer(testMachine, (a) => a.valid && a);
    let validAction = {
      event: 'T',
      valid: true
    };

    let invalidAction = {
      event: 'T',
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
