import { createMachine } from '../src/index.ts';
import { raise } from '../src/actions.ts';
import { toSCXMLEvent } from '../src/utils';

describe('action creators', () => {
  describe('raise()', () => {
    it('should accept a string event', () => {
      const action = raise({ type: 'foo' });
      expect(action.params).toEqual(
        expect.objectContaining({
          event: { type: 'foo' },
          delay: undefined,
          id: 'foo'
        })
      );
    });

    it('should accept an event object', () => {
      const event = {
        type: 'foo' as const,
        bar: 'baz'
      };
      const action = raise<{}, typeof event>(event);
      expect(action.params).toEqual(
        expect.objectContaining({
          event: { type: 'foo', bar: 'baz' },
          delay: undefined,
          id: 'foo'
        })
      );
    });

    it('should accept an id option', () => {
      const action = raise({ type: 'foo' }, { id: 'foo-id' });
      expect(action.params).toEqual(
        expect.objectContaining({
          event: { type: 'foo' },
          delay: undefined,
          id: 'foo-id'
        })
      );
    });

    it('should accept a delay option', () => {
      const action = raise({ type: 'foo' }, { delay: 1000 });
      expect(action.params).toEqual(
        expect.objectContaining({
          event: { type: 'foo' },
          delay: 1000,
          id: 'foo'
        })
      );
    });

    it('should accept a delay option (expression)', () => {
      const action = raise<
        { delay: number },
        { type: 'EVENT'; value: number } | { type: 'RECEIVED' }
      >(
        { type: 'RECEIVED' },
        {
          delay: ({ context, event }) =>
            context.delay + ('value' in event ? event.value : 0)
        }
      );

      const machine = createMachine<any, any>({});

      const [, resolvedAction] = action.resolve(
        toSCXMLEvent({ type: 'EVENT', value: 50 } as {
          type: 'EVENT';
          value: number;
        }),
        {
          state: machine.createState({
            context: { delay: 100 },
            value: {},
            _event: {} as any,
            transitions: [],
            children: {}
          }) as any, // TODO: fix
          action,
          actorContext: undefined
        }
      );

      expect(resolvedAction.params.delay).toEqual(150);
    });
  });
});
