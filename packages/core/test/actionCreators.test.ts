import * as actions from '../src/actions';
import { toSCXMLEvent } from '../src/utils';

const { actionTypes } = actions;

describe('action creators', () => {
  ['start', 'stop'].forEach(actionKey => {
    const startOrStop: typeof actions['start'] | typeof actions['stop'] =
      actions[actionKey];
    describe(`${actionKey}()`, () => {
      it('should accept a string source', () => {
        const action = startOrStop('test');
        expect(action.type).toEqual(actionTypes[actionKey]);
        expect(action).toEqual({
          actor: undefined,
          type: actionTypes[actionKey],
          exec: undefined,
          def: {
            id: 'test',
            src: 'test'
          }
        });
      });

      it('should accept an invoke definition', () => {
        const action = startOrStop({
          type: 'test',
          id: 'testid',
          meta: { foo: 'bar' },
          src: 'someSrc'
        });
        expect(action.type).toEqual(actionTypes[actionKey]);
        expect(action).toEqual({
          actor: undefined,
          type: actionTypes[actionKey],
          exec: undefined,
          def: {
            type: 'test',
            id: 'testid',
            meta: { foo: 'bar' },
            src: 'someSrc'
          }
        });
      });
    });
  });

  describe('send()', () => {
    it('should accept a string event', () => {
      const action = actions.send('foo');
      expect(action).toEqual({
        to: undefined,
        type: actionTypes.send,
        event: { type: 'foo' },
        delay: undefined,
        id: 'foo'
      });
    });

    it('should accept an event object', () => {
      const action = actions.send({ type: 'foo', bar: 'baz' });
      expect(action).toEqual({
        to: undefined,
        type: actionTypes.send,
        event: { type: 'foo', bar: 'baz' },
        delay: undefined,
        id: 'foo'
      });
    });

    it('should accept an id option', () => {
      const action = actions.send('foo', { id: 'foo-id' });
      expect(action).toEqual({
        to: undefined,
        type: actionTypes.send,
        event: { type: 'foo' },
        delay: undefined,
        id: 'foo-id'
      });
    });

    it('should accept a delay option', () => {
      const action = actions.send('foo', { delay: 1000 });
      expect(action).toEqual({
        to: undefined,
        type: actionTypes.send,
        event: { type: 'foo' },
        delay: 1000,
        id: 'foo'
      });
    });

    it('should accept a delay option (expression)', () => {
      const action = actions.send<
        { delay: number },
        { type: 'EVENT'; value: number } | { type: 'RECEIVED' }
      >('RECEIVED', {
        delay: (ctx, e) => ctx.delay + ('value' in e ? e.value : 0)
      });

      const resolvedAction = actions.resolveSend(
        action,
        { delay: 100 },
        toSCXMLEvent({ type: 'EVENT', value: 50 })
      );

      expect(resolvedAction.delay).toEqual(150);
    });
  });
});
