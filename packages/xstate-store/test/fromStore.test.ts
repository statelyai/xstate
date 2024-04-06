import { createActor } from 'xstate';
import { fromStore } from '../src/index.ts';

describe('fromStore', () => {
  it('creates an actor from store logic with input', () => {
    const storeLogic = fromStore((count: number) => ({ count }), {
      inc: {
        count: (ctx, ev: { by: number }) => {
          return ctx.count + ev.by;
        }
      }
    });

    const actor = createActor(storeLogic, {
      input: 42
    });

    actor.start();

    actor.send({ type: 'inc', by: 8 });

    expect(actor.getSnapshot().context.count).toEqual(50);
  });
});
