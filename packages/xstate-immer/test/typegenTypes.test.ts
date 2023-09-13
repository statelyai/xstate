import { createMachine, TypegenMeta } from 'xstate';
import { assign } from '../src';

describe('@xstate/immer', () => {
  it('should infer an action object with narrowed event type', () => {
    interface TypesMeta extends TypegenMeta {
      eventsCausingActions: {
        doSomething: 'update';
      };
    }

    createMachine(
      {
        context: {
          count: 0
        },
        types: {
          typegen: {} as TypesMeta,
          context: {} as { count: number },
          events: {} as
            | {
                type: 'TOGGLE';
              }
            | {
                type: 'update';
                data: { count: number };
              }
        }
      },
      {
        actions: {
          doSomething: assign(({ context, event }) => {
            ((_accept: 'update') => {})(event.type);
            // no error
            context.count += event.data.count;
            // @ts-expect-error
            ((_accept: "test that this isn't any") => {})(event);
            // @ts-expect-error
            ((_accept: "test that this isn't any") => {})(event.data);
          })
        }
      }
    );
  });
});
