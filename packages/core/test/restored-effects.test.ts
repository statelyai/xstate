import {
  createActor,
  createCallbackLogic,
  createLogic,
  createAsyncLogic,
  waitFor
} from '../src/index.ts';

it('reattaches a JSON-restored callback and cleans up each incarnation', () => {
  const receive = vi.fn();
  const cleanup = vi.fn();
  const start = vi.fn();
  const logic = createCallbackLogic(({ receive: listen }) => {
    start();
    listen(receive);
    return cleanup;
  });
  const first = createActor(logic).start();
  const snapshot = JSON.parse(JSON.stringify(first.getPersistedSnapshot()));
  first.stop();
  const restored = createActor(logic, { snapshot }).start();
  restored.send({ type: 'PING' });
  expect(start).toHaveBeenCalledTimes(2);
  expect(receive).toHaveBeenCalledExactlyOnceWith({ type: 'PING' });
  restored.stop();
  expect(cleanup).toHaveBeenCalledTimes(2);
});

it('reattaches active keyed effects without replaying completed effects', () => {
  const active = vi.fn();
  const completed = vi.fn();
  const logic = createLogic({
    context: undefined,
    run: (_, enq) => {
      enq.effect('active', active);
      enq.effect('completed', completed);
    }
  });
  const first = createActor(logic).start();
  const snapshot = JSON.parse(JSON.stringify(first.getPersistedSnapshot()));
  snapshot.effects.completed = { status: 'done', output: 42 };
  first.stop();
  const restored = createActor(logic, { snapshot }).start();
  restored.send({ type: 'PING' });
  expect(active).toHaveBeenCalledTimes(2);
  expect(completed).toHaveBeenCalledTimes(1);
  restored.stop();
});

it('deduplicates concurrently started local steps and settles waiters on stop', async () => {
  const exec = vi.fn(() => new Promise<number>(() => {}));
  let first!: Promise<number>;
  let second!: Promise<number>;
  const actor = createActor(
    createAsyncLogic({
      run: async (_, enq) => {
        first = enq.step('work', exec);
        second = enq.step('work', exec);
        return Promise.all([first, second]);
      }
    })
  ).start();
  await waitFor(actor, (s) => s.effects?.work?.status === 'active');
  const firstRejected = expect(first).rejects.toThrow('terminated');
  const secondRejected = expect(second).rejects.toThrow('terminated');
  actor.stop();
  await Promise.all([firstRejected, secondRejected]);
  expect(exec).toHaveBeenCalledTimes(1);
});

it.each(['constructor', 'toString', '__proto__'])(
  'journals and restores an effect keyed %s',
  (key) => {
    const run = vi.fn();
    const logic = createLogic({
      context: undefined,
      run: (_, enq) => enq.effect(key, run)
    });
    const first = createActor(logic).start();
    expect(run).toHaveBeenCalledTimes(1);
    const snapshot = JSON.parse(JSON.stringify(first.getPersistedSnapshot()));
    expect(Object.hasOwn(snapshot.effects, key)).toBe(true);
    expect(snapshot.effects[key]).toEqual({ status: 'active' });
    first.stop();
    const restored = createActor(logic, { snapshot }).start();
    expect(run).toHaveBeenCalledTimes(2);
    restored.stop();
  }
);

it.each(['constructor', 'toString', '__proto__'])(
  'reuses JSON-restored completed steps keyed %s',
  async (key) => {
    const work = vi.fn(async () => 42);
    let result!: Promise<number>;
    const logic = createAsyncLogic({
      run: (_, enq) => {
        result = enq.step(key, work);
        return new Promise(() => {});
      }
    });
    const first = createActor(logic).start();
    expect(await result).toBe(42);
    const snapshot = JSON.parse(JSON.stringify(first.getPersistedSnapshot()));
    expect(Object.hasOwn(snapshot.effects, key)).toBe(true);
    first.stop();
    const restored = createActor(logic, { snapshot }).start();
    expect(await result).toBe(42);
    expect(work).toHaveBeenCalledTimes(1);
    restored.stop();
  }
);

it.each(['constructor', 'toString'])(
  'does not mistake inherited journal values for an effect keyed %s',
  (key) => {
    const run = vi.fn();
    const actor = createActor(
      createLogic({
        context: undefined,
        run: ({ event }, enq) => {
          if (event.type === 'RUN') enq.effect(key, run);
          else enq.effect('seed', () => {});
        }
      })
    ).start();
    actor.send({ type: 'RUN' });
    expect(run).toHaveBeenCalledTimes(1);
    actor.stop();
  }
);

it('drains all attachment cleanups once when the first throws', () => {
  const error = new Error('cleanup failed');
  const failed = vi.fn(() => {
    throw error;
  });
  const later = vi.fn();
  const observed = vi.fn();
  const actor = createActor(
    createLogic({
      context: undefined,
      run: (_, enq) => {
        enq.effect('first', () => failed);
        enq.effect('later', () => later);
      }
    })
  );
  actor.subscribe({ error: observed });
  actor.start();
  actor.stop();
  actor.stop();
  expect(failed).toHaveBeenCalledTimes(1);
  expect(later).toHaveBeenCalledTimes(1);
  expect(observed).toHaveBeenCalledExactlyOnceWith(error);
});
