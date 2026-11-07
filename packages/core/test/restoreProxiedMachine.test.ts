import { createActor, createMachine } from '../src/index.ts';
import { restoreActor } from '../src/persist/index.ts';

/** A deep wrapping Proxy, like Vue's `reactive`: objects come back wrapped, functions do not. */
function deepProxy<T extends object>(
  target: T,
  cache = new WeakMap<object, any>()
): T {
  const wrapped = cache.get(target);
  if (wrapped) return wrapped;
  const proxy = new Proxy(target, {
    get(t, key, receiver) {
      const value = Reflect.get(t, key, receiver);
      return value !== null &&
        typeof value === 'object' &&
        !(value instanceof Map) &&
        !(value instanceof Set)
        ? deepProxy(value, cache)
        : value;
    }
  });
  cache.set(target, proxy);
  return proxy;
}

describe('restoreActor with a Proxy-wrapped machine', () => {
  const machine = createMachine({
    id: 'm',
    version: '1',
    initial: 'a',
    states: { a: { on: { go: { target: 'b' } } }, b: {} }
  });
  const persisted = JSON.parse(
    JSON.stringify(createActor(machine).start().getPersistedSnapshot())
  );

  it('keeps a consistent state value after the next transition', () => {
    const actor = restoreActor(deepProxy(machine), persisted).start();
    actor.send({ type: 'go' });
    expect(actor.getSnapshot().value).toBe('b');
  });

  it('matches the unproxied machine', () => {
    const actor = restoreActor(machine, persisted).start();
    actor.send({ type: 'go' });
    expect(actor.getSnapshot().value).toBe('b');
  });

  it('keeps a consistent state value after a restored delay fires', async () => {
    const timedMachine = createMachine({
      id: 'timed',
      version: '1',
      initial: 'waiting',
      states: {
        waiting: { after: { 10: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const source = createActor(timedMachine).start();
    const timedPersisted = JSON.parse(
      JSON.stringify(source.getPersistedSnapshot())
    );
    source.stop();
    const actor = restoreActor(deepProxy(timedMachine), timedPersisted).start();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(actor.getSnapshot().value).toBe('done');
    expect(actor.getSnapshot().status).toBe('done');
  });
});
