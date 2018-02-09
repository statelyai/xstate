import * as actions from '../src/actions';
import { assert } from 'chai';

const { actionTypes } = actions;

describe('action creators', () => {
  Object.keys(actionTypes).forEach(actionKey => {
    describe(`${actionKey}()`, () => {
      it('should accept a string action', () => {
        const action = actions[actionKey]('test');
        assert.equal(action.type, actionTypes[actionKey]);
        assert.deepEqual(action.data, {
          type: 'test'
        });
      });

      it('should accept an action object', () => {
        const action = actions[actionKey]({ type: 'test', foo: 'bar' });
        assert.equal(action.type, actionTypes[actionKey]);
        assert.deepEqual(action.data, {
          type: 'test',
          foo: 'bar'
        });
      });
    });
  });
});
