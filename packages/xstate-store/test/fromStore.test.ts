import { createActor } from 'xstate';
import { fromStore } from '../src/index.ts';

describe('fromStore', () => {
  it('creates an actor from store logic with input', () => {
    const storeLogic = fromStore({
      context: (count: number) => ({ count }),
      on: {
        inc: (ctx, ev: { by: number }) => {
          return {
            ...ctx,
            count: ctx.count + ev.by
          };
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

  it('emits events', () => {
    const spy = jest.fn();

    const storeLogic = fromStore({
      context: (count: number) => ({ count }),
      emits: {
        increased: (_: { upBy: number }) => {}
      },
      on: {
        inc: (ctx, ev: { by: number }, enq) => {
          enq.emit.increased({ upBy: ev.by });
          return {
            ...ctx,
            count: ctx.count + ev.by
          };
        }
      }
    });

    const actor = createActor(storeLogic, {
      input: 42
    });

    actor.on('increased', spy);

    actor.start();

    actor.send({ type: 'inc', by: 8 });

    expect(actor.getSnapshot().context.count).toEqual(50);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ type: 'increased', upBy: 8 });
  });
});
