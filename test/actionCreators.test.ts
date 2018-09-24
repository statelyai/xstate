import * as actions from '../src/actions';
import { assert } from 'chai';

const { actionTypes } = actions;

xdescribe('action creators', () => {
  ['start', 'stop'].forEach(actionKey => {
    describe(`${actionKey}()`, () => {
      it('should accept a string action', () => {
        const action = actions[actionKey]('test');
        assert.equal(action.type, actionTypes[actionKey]);
        assert.deepEqual(action, {
          type: actionTypes[actionKey],
          exec: undefined,
          activity: {
            type: 'test',
            exec: undefined,
            start: undefined,
            stop: undefined
          }
        });
      });

      it('should accept an action object', () => {
        const action = actions[actionKey]({ type: 'test', foo: 'bar' });
        assert.equal(action.type, actionTypes[actionKey]);
        assert.deepEqual(action, {
          type: actionTypes[actionKey],
          exec: undefined,
          activity: {
            type: 'test',
            foo: 'bar',
            start: undefined,
            stop: undefined
          }
        });
      });

      it('should accept an activity definition', () => {
        const startFoo = () => 'start foo';
        const stopFoo = () => 'stop foo';
        const action = actions[actionKey]({
          type: 'test',
          foo: 'bar',
          start: startFoo,
          stop: stopFoo
        });
        assert.equal(action.type, actionTypes[actionKey]);
        assert.deepEqual(action, {
          type: actionTypes[actionKey],
          exec: action.activity[actionKey].exec,
          activity: {
            type: 'test',
            foo: 'bar',
            start: { type: 'startFoo', exec: startFoo },
            stop: { type: 'stopFoo', exec: stopFoo }
          }
        });
      });
    });
  });

  describe('send()', () => {
    it('should accept a string event', () => {
      const action = actions.send('foo');
      assert.deepEqual(action, {
        target: undefined,
        type: actionTypes.send,
        event: { type: 'foo' },
        delay: undefined,
        id: 'foo'
      });
    });

    it('should accept an event object', () => {
      const action = actions.send({ type: 'foo', bar: 'baz' });
      assert.deepEqual(action, {
        target: undefined,
        type: actionTypes.send,
        event: { type: 'foo', bar: 'baz' },
        delay: undefined,
        id: 'foo'
      });
    });

    it('should accept an id option', () => {
      const action = actions.send('foo', { id: 'foo-id' });
      assert.deepEqual(action, {
        target: undefined,
        type: actionTypes.send,
        event: { type: 'foo' },
        delay: undefined,
        id: 'foo-id'
      });
    });

    it('should accept a delay option', () => {
      const action = actions.send('foo', { delay: 1000 });
      assert.deepEqual(action, {
        target: undefined,
        type: actionTypes.send,
        event: { type: 'foo' },
        delay: 1000,
        id: 'foo'
      });
    });
  });
});
