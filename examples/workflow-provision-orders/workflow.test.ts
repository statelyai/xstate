import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createActor, createAsyncLogic, types } from 'xstate';
import { workflow } from './workflow.ts';
const actors: { stop(): unknown }[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  for (const actor of actors.splice(0)) actor.stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it.each(['id', 'item', 'quantity', null] as const)(
  'routes missing field %s',
  async (field) => {
    const order = { id: 'o1', item: 'book', quantity: '2' };
    if (field) order[field] = '';
    const actor = createActor(workflow, { input: { order } }).start();
    actors.push(actor);
    await vi.advanceTimersByTimeAsync(1000);
    expect(actor.getSnapshot().value).toEqual(
      field
        ? {
            Exception: {
              id: 'MissingId',
              item: 'MissingItem',
              quantity: 'MissingQuantity'
            }[field]
          }
        : 'ApplyOrder'
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(actor.getSnapshot().status).toBe('done');
  }
);

it('surfaces an unexpected provisioning failure', async () => {
  const error = new Error('network');
  const order = { id: 'o1', item: 'book', quantity: '2' };
  const actor = createActor(
    workflow.provide({
      actors: {
        provisionOrderFunction: createAsyncLogic({
          schemas: { input: types<{ order: typeof order }>() },
          run: () => Promise.reject<{ order: typeof order }>(error)
        })
      }
    }),
    { input: { order } }
  );
  actors.push(actor);
  const observed = vi.fn();
  actor.subscribe({ error: observed });
  actor.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(actor.getSnapshot().status).toBe('error');
  expect(actor.getSnapshot().error).toBe(error);
  expect(observed).toHaveBeenCalledExactlyOnceWith(error);
});
