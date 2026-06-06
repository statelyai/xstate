import { createActor } from 'xstate';
import { fromStore } from '../src/index.ts';
import type { StoreEffectEnqueue } from '../src/index.ts';
import { z } from 'zod';

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
    const spy = vi.fn();

    const storeLogic = fromStore({
      context: (count: number) => ({ count }),
      schemas: {
        emitted: {
          increased: z.object({ upBy: z.number() })
        }
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

  it('enq.getSnapshot() in a sync effect reflects the post-transition state (matches createStore)', () => {
    let seen: number | undefined;

    const storeLogic = fromStore({
      context: (_: void) => ({ count: 0 }),
      on: {
        inc: (ctx, _, enq) => {
          enq.effect(
            ({ getSnapshot }: StoreEffectEnqueue<{ count: number }>) => {
              seen = getSnapshot().context.count;
            }
          );
          return { ...ctx, count: ctx.count + 1 };
        }
      }
    });

    const actor = createActor(storeLogic).start();
    actor.send({ type: 'inc' });

    expect(seen).toEqual(1);
  });

  it('enq.getSnapshot() in an async effect reflects the latest committed state', async () => {
    let seen: number | undefined;

    const storeLogic = fromStore({
      context: (_: void) => ({ count: 0 }),
      on: {
        start: (ctx, _, enq) => {
          enq.effect(
            async ({ getSnapshot }: StoreEffectEnqueue<{ count: number }>) => {
              await new Promise((resolve) => setTimeout(resolve, 5));
              seen = getSnapshot().context.count;
            }
          );
          return { ...ctx, count: ctx.count + 1 };
        },
        bump: (ctx) => ({ count: ctx.count + 10 })
      }
    });

    const actor = createActor(storeLogic).start();
    actor.send({ type: 'start' }); // count -> 1
    actor.send({ type: 'bump' }); // count -> 11 before the async effect resumes

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(seen).toEqual(11);
  });
});
