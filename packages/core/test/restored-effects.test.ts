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
