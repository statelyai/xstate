import { createActor, waitFor } from '../src/index.ts';
import { next_createMachine } from '../src/index.ts';

describe('waitFor', () => {
  it('should wait for a condition to be true and return the emitted value', async () => {
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {}
      }
    });

    const actor = createActor(machine).start();

    setTimeout(() => actor.send({ type: 'NEXT' }), 10);

    const state = await waitFor(actor, (s) => s.matches('b'));

    expect(state.value).toEqual('b');
  });

  it('should throw an error after a timeout', async () => {
    const machine = next_createMachine({
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

    const actor = createActor(machine).start();

    try {
      await waitFor(actor, (state) => state.matches('c'), { timeout: 10 });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it('should not reject immediately when passing Infinity as timeout', async () => {
    const machine = next_createMachine({
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
    const actor = createActor(machine).start();
    const result = await Promise.race([
      waitFor(actor, (state) => state.matches('c'), {
        timeout: Infinity
      }),
      new Promise((res) => setTimeout(res, 10)).then(() => 'timeout')
    ]);

    expect(result).toBe('timeout');
    actor.stop();
  });

  it('should throw an error when reaching a final state that does not match the predicate', async () => {
    const machine = next_createMachine({
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

    const actor = createActor(machine).start();

    setTimeout(() => {
      actor.send({ type: 'NEXT' });
    }, 10);

    await expect(
      waitFor(actor, (state) => state.matches('never'))
    ).rejects.toMatchInlineSnapshot(
      `[Error: Actor terminated without satisfying predicate]`
    );
  });

  it('should resolve correctly when the predicate immediately matches the current state', async () => {
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {}
      }
    });

    const actor = createActor(machine).start();

    await expect(
      waitFor(actor, (state) => state.matches('a'))
    ).resolves.toHaveProperty('value', 'a');
  });

  it('should not subscribe when the predicate immediately matches', () => {
    const machine = next_createMachine({});

    const actorRef = createActor(machine).start();
    const spy = jest.fn();
    actorRef.subscribe = spy;

    waitFor(actorRef, () => true).then(() => {});

    expect(spy).not.toHaveBeenCalled();
  });

  it('should internally unsubscribe when the predicate immediately matches the current state', async () => {
    let count = 0;
    const machine = next_createMachine({
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

    const actor = createActor(machine).start();

    await waitFor(actor, (state) => {
      count++;
      return state.matches('a');
    });

    actor.send({ type: 'NEXT' });

    expect(count).toBe(1);
  });

  it('should immediately resolve for an actor in its final state that matches the predicate', async () => {
    const machine = next_createMachine({
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

    const actor = createActor(machine).start();
    actor.send({ type: 'NEXT' });

    await expect(
      waitFor(actor, (state) => state.matches('b'))
    ).resolves.toHaveProperty('value', 'b');
  });

  it('should immediately reject for an actor in its final state that does not match the predicate', async () => {
    const machine = next_createMachine({
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

    const actor = createActor(machine).start();
    actor.send({ type: 'NEXT' });

    await expect(
      waitFor(actor, (state) => state.matches('a'))
    ).rejects.toMatchInlineSnapshot(
      `[Error: Actor terminated without satisfying predicate]`
    );
  });

  it('should not subscribe to the actor when it receives an aborted signal', async () => {
    const machine = next_createMachine({
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

    const actor = createActor(machine).start();
    actor.send({ type: 'NEXT' });

    const controller = new AbortController();
    const { signal } = controller;
    controller.abort(new Error('Aborted!'));
    const spy = jest.fn();
    actor.subscribe = spy;
    try {
      await waitFor(actor, (state) => state.matches('b'), { signal });
      fail('should have rejected');
    } catch {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('should not listen for the "abort" event when it receives an aborted signal', async () => {
    const machine = next_createMachine({
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

    const actor = createActor(machine).start();
    actor.send({ type: 'NEXT' });

    const controller = new AbortController();
    const { signal } = controller;
    controller.abort(new Error('Aborted!'));

    const spy = jest.fn();
    signal.addEventListener = spy;

    try {
      await waitFor(actor, (state) => state.matches('b'), { signal });
      fail('should have rejected');
    } catch {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('should not listen for the "abort" event for actor in its final state that matches the predicate', async () => {
    const machine = next_createMachine({
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

    const actor = createActor(machine).start();
    actor.send({ type: 'NEXT' });

    const controller = new AbortController();
    const { signal } = controller;

    const spy = jest.fn();
    signal.addEventListener = spy;

    await waitFor(actor, (state) => state.matches('b'), { signal });
    expect(spy).not.toHaveBeenCalled();
  });

  it('should immediately reject when it receives an aborted signal', async () => {
    const machine = next_createMachine({
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

    const actor = createActor(machine).start();
    actor.send({ type: 'NEXT' });

    const controller = new AbortController();
    const { signal } = controller;
    controller.abort(new Error('Aborted!'));

    await expect(
      waitFor(actor, (state) => state.matches('b'), { signal })
    ).rejects.toMatchInlineSnapshot(`[Error: Aborted!]`);
  });

  it('should reject when the signal is aborted while waiting', async () => {
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {}
      }
    });

    const actor = createActor(machine).start();
    const controller = new AbortController();
    const { signal } = controller;
    setTimeout(() => controller.abort(new Error('Aborted!')), 10);

    await expect(
      waitFor(actor, (state) => state.matches('b'), { signal })
    ).rejects.toMatchInlineSnapshot(`[Error: Aborted!]`);
  });

  it('should stop listening for the "abort" event upon successful completion', async () => {
    const machine = next_createMachine({
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

    const actor = createActor(machine).start();
    setTimeout(() => {
      actor.send({ type: 'NEXT' });
    }, 10);

    const controller = new AbortController();
    const { signal } = controller;
    const spy = jest.fn();
    signal.removeEventListener = spy;

    await waitFor(actor, (state) => state.matches('b'), { signal });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should stop listening for the "abort" event upon failure', async () => {
    const machine = next_createMachine({
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

    const actor = createActor(machine).start();

    setTimeout(() => {
      actor.send({ type: 'NEXT' });
    }, 10);

    const controller = new AbortController();
    const { signal } = controller;
    const spy = jest.fn();
    signal.removeEventListener = spy;

    try {
      await waitFor(actor, (state) => state.matches('never'), { signal });
      fail('should have rejected');
    } catch {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});
