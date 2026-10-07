import {
  createActor,
  waitFor,
  createMachine,
  fromTransition
} from '../src/index.ts';

describe('waitFor', () => {
  describe('cleanup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('should unsubscribe and remove the abort listener after timing out', async () => {
      const actor = createActor(createMachine({})).start();
      const controller = new AbortController();
      const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
      const predicate = vi.fn(() => false);
      const promise = waitFor(actor, predicate, {
        timeout: 10,
        signal: controller.signal
      });
      const rejection = expect(promise).rejects.toThrow(
        'Timeout of 10 ms exceeded'
      );

      vi.advanceTimersByTime(10);
      await rejection;

      expect(removeListener).toHaveBeenCalledWith(
        'abort',
        expect.any(Function)
      );
      expect(vi.getTimerCount()).toBe(0);
      predicate.mockClear();
      actor.send({ type: 'NEXT' });
      expect(predicate).not.toHaveBeenCalled();
      actor.stop();
    });

    it('should unsubscribe and clear the timeout after aborting', async () => {
      const actor = createActor(createMachine({})).start();
      const controller = new AbortController();
      const predicate = vi.fn(() => false);
      const reason = new Error('Canceled');
      const promise = waitFor(actor, predicate, {
        timeout: 100,
        signal: controller.signal
      });
      const rejection = expect(promise).rejects.toBe(reason);

      controller.abort(reason);
      await rejection;

      expect(vi.getTimerCount()).toBe(0);
      predicate.mockClear();
      actor.send({ type: 'NEXT' });
      expect(predicate).not.toHaveBeenCalled();
      actor.stop();
    });

    it('should clear the timeout and remove the abort listener after an actor error', async () => {
      const error = new Error('Actor failed');
      const actor = createActor(
        fromTransition(() => {
          throw error;
        }, 0)
      ).start();
      const controller = new AbortController();
      const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
      const promise = waitFor(actor, () => false, {
        timeout: 100,
        signal: controller.signal
      });
      const rejection = expect(promise).rejects.toBe(error);

      actor.send({ type: 'FAIL' });
      await rejection;

      expect(vi.getTimerCount()).toBe(0);
      expect(removeListener).toHaveBeenCalledWith(
        'abort',
        expect.any(Function)
      );
    });

    it('should clear the timeout when a later snapshot matches', async () => {
      const actor = createActor(
        createMachine({
          initial: 'waiting',
          states: {
            waiting: { on: { NEXT: 'ready' } },
            ready: {}
          }
        })
      ).start();
      const promise = waitFor(actor, (snapshot) => snapshot.matches('ready'), {
        timeout: 100
      });

      actor.send({ type: 'NEXT' });
      await expect(promise).resolves.toBe(actor.getSnapshot());

      expect(vi.getTimerCount()).toBe(0);
      actor.stop();
    });
  });

  it('should wait for a condition to be true and return the emitted value', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {}
      }
    });

    const service = createActor(machine).start();

    setTimeout(() => service.send({ type: 'NEXT' }), 10);

    const state = await waitFor(service, (s) => s.matches('b'));

    expect(state.value).toEqual('b');
  });

  it('should throw an error after a timeout', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {
          on: { NEXT: 'c' }
        },
        c: {}
      }
    });

    const service = createActor(machine).start();

    try {
      await waitFor(service, (state) => state.matches('c'), { timeout: 10 });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it('should not reject immediately when passing Infinity as timeout', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {
          on: { NEXT: 'c' }
        },
        c: {}
      }
    });
    const service = createActor(machine).start();
    const result = await Promise.race([
      waitFor(service, (state) => state.matches('c'), {
        timeout: Infinity
      }),
      new Promise((res) => setTimeout(res, 10)).then(() => 'timeout')
    ]);

    expect(result).toBe('timeout');
    service.stop();
  });

  it('should throw an error when reaching a final state that does not match the predicate', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine).start();

    setTimeout(() => {
      service.send({ type: 'NEXT' });
    }, 10);

    await expect(
      waitFor(service, (state) => state.matches('never'))
    ).rejects.toMatchInlineSnapshot(
      `[Error: Actor terminated without satisfying predicate]`
    );
  });

  it('should resolve correctly when the predicate immediately matches the current state', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {}
      }
    });

    const service = createActor(machine).start();

    await expect(
      waitFor(service, (state) => state.matches('a'))
    ).resolves.toHaveProperty('value', 'a');
  });

  it('should not subscribe when the predicate immediately matches', () => {
    const machine = createMachine({});

    const actorRef = createActor(machine).start();
    const spy = vi.fn();
    actorRef.subscribe = spy;

    waitFor(actorRef, () => true).then(() => {});

    expect(spy).not.toHaveBeenCalled();
  });

  it('should internally unsubscribe when the predicate immediately matches the current state', async () => {
    let count = 0;
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {}
      }
    });

    const service = createActor(machine).start();

    await waitFor(service, (state) => {
      count++;
      return state.matches('a');
    });

    service.send({ type: 'NEXT' });

    expect(count).toBe(1);
  });

  it('should immediately resolve for an actor in its final state that matches the predicate', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });

    await expect(
      waitFor(service, (state) => state.matches('b'))
    ).resolves.toHaveProperty('value', 'b');
  });

  it('should immediately reject for an actor in its final state that does not match the predicate', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });

    await expect(
      waitFor(service, (state) => state.matches('a'))
    ).rejects.toMatchInlineSnapshot(
      `[Error: Actor terminated without satisfying predicate]`
    );
  });

  it('should not subscribe to the actor when it receives an aborted signal', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });

    const controller = new AbortController();
    const { signal } = controller;
    controller.abort(new Error('Aborted!'));
    const spy = vi.fn();
    service.subscribe = spy;
    try {
      await waitFor(service, (state) => state.matches('b'), { signal });
      throw new Error('Should not be reached');
    } catch {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('should not listen for the "abort" event when it receives an aborted signal', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });

    const controller = new AbortController();
    const { signal } = controller;
    controller.abort(new Error('Aborted!'));

    const spy = vi.fn();
    signal.addEventListener = spy;

    try {
      await waitFor(service, (state) => state.matches('b'), { signal });
      throw new Error('Should not be reached');
    } catch {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('should not listen for the "abort" event for actor in its final state that matches the predicate', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });

    const controller = new AbortController();
    const { signal } = controller;

    const spy = vi.fn();
    signal.addEventListener = spy;

    await waitFor(service, (state) => state.matches('b'), { signal });
    expect(spy).not.toHaveBeenCalled();
  });

  it('should immediately reject when it receives an aborted signal', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });

    const controller = new AbortController();
    const { signal } = controller;
    controller.abort(new Error('Aborted!'));

    await expect(
      waitFor(service, (state) => state.matches('b'), { signal })
    ).rejects.toMatchInlineSnapshot(`[Error: Aborted!]`);
  });

  it('should reject when the signal is aborted while waiting', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {}
      }
    });

    const service = createActor(machine).start();
    const controller = new AbortController();
    const { signal } = controller;
    setTimeout(() => controller.abort(new Error('Aborted!')), 10);

    await expect(
      waitFor(service, (state) => state.matches('b'), { signal })
    ).rejects.toMatchInlineSnapshot(`[Error: Aborted!]`);
  });

  it('should stop listening for the "abort" event upon successful completion', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine).start();
    setTimeout(() => {
      service.send({ type: 'NEXT' });
    }, 10);

    const controller = new AbortController();
    const { signal } = controller;
    const spy = vi.fn();
    signal.removeEventListener = spy;

    await waitFor(service, (state) => state.matches('b'), { signal });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should stop listening for the "abort" event upon failure', async (ctx) => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine).start();

    setTimeout(() => {
      service.send({ type: 'NEXT' });
    }, 10);

    const controller = new AbortController();
    const { signal } = controller;
    const spy = vi.fn();
    signal.removeEventListener = spy;

    try {
      await waitFor(service, (state) => state.matches('never'), { signal });
      throw new Error('Should not be reached');
    } catch {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});
