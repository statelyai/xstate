import { createActor, createMachine, waitFor } from '../src/index.ts';

it('clears the timeout when the initial waitFor predicate throws', async () => {
  vi.useFakeTimers();
  const actor = createActor(createMachine({})).start();
  const error = new Error('Predicate failed');
  const subscribe = vi.spyOn(actor, 'subscribe');

  try {
    await expect(
      waitFor(
        actor,
        () => {
          throw error;
        },
        { timeout: 1000 }
      )
    ).rejects.toBe(error);

    expect(vi.getTimerCount()).toBe(0);
    expect(subscribe).not.toHaveBeenCalled();
  } finally {
    subscribe.mockRestore();
    actor.stop();
    vi.useRealTimers();
  }
});

it('rejects and disposes when a later waitFor predicate throws', async () => {
  vi.useFakeTimers();
  const actor = createActor(
    createMachine({
      initial: 'a',
      states: {
        a: { on: { GO: { target: 'b' } } },
        b: { on: { GO: { target: 'c' } } },
        c: {}
      }
    })
  ).start();
  const error = new Error('Predicate failed');
  const controller = new AbortController();
  const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
  const predicate = vi.fn((snapshot: ReturnType<typeof actor.getSnapshot>) => {
    if (snapshot.value === 'b') {
      throw error;
    }
    return false;
  });

  try {
    const result = waitFor(actor, predicate, {
      timeout: 1000,
      signal: controller.signal
    });
    const rejection = expect(result).rejects.toBe(error);

    actor.send({ type: 'GO' });
    await rejection;

    expect(vi.getTimerCount()).toBe(0);
    expect(removeListener).toHaveBeenCalledTimes(1);

    actor.send({ type: 'GO' });
    expect(predicate).toHaveBeenCalledTimes(2);
  } finally {
    removeListener.mockRestore();
    actor.stop();
    vi.useRealTimers();
  }
});
