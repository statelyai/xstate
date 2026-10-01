import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStore } from '../src/index.ts';
import {
  clearStorage,
  flushStorage,
  persist,
  rehydrateStore,
  type StateStorage
} from '../src/persist.ts';

function createStorage(): StateStorage {
  const values = new Map<string, string>();
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => {
      values.set(name, value);
    },
    removeItem: (name) => {
      values.delete(name);
    }
  };
}

function createCounter(
  storage: StateStorage,
  options: { throttle?: number; maxEvents?: number } = {}
) {
  return createStore({
    context: { count: 0 },
    on: {
      add: (context, event: { amount: number }) => ({
        count: context.count + event.amount
      })
    }
  }).with(persist({ name: 'counter', storage, strategy: 'event', ...options }));
}

describe('clearStorage event history', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([0, 100])(
    'starts a new event log from the live context (throttle %i)',
    (throttle) => {
      vi.useFakeTimers();
      const storage = createStorage();
      const store = createCounter(storage, { throttle });
      store.trigger.add({ amount: 2 });
      store.trigger.add({ amount: 5 });
      const beforeClear = Object.freeze(store.getSnapshot());
      Object.freeze(beforeClear.context);

      // clearStorage only requires getSnapshot, and must not mutate snapshots.
      expect(clearStorage({ getSnapshot: store.getSnapshot })).toBeUndefined();
      expect(store.getSnapshot()).toBe(beforeClear);
      expect(store.getSnapshot().context).toEqual({ count: 7 });
      vi.advanceTimersByTime(100);
      expect(storage.getItem('counter')).toBeNull();

      store.trigger.add({ amount: 3 });
      flushStorage(store);
      expect(JSON.parse(storage.getItem('counter') as string)).toEqual({
        events: [{ type: 'add', amount: 3 }],
        checkpoint: { count: 7 },
        version: 0
      });
      expect(beforeClear.context).toEqual({ count: 7 });
      expect(createCounter(storage).getSnapshot().context).toEqual({
        count: 10
      });
    }
  );

  it('replaces an existing checkpoint and still truncates the new log correctly', () => {
    const storage = createStorage();
    const store = createCounter(storage, { maxEvents: 2 });
    for (const amount of [2, 3, 5]) {
      store.trigger.add({ amount });
    }
    expect(JSON.parse(storage.getItem('counter') as string).checkpoint).toEqual(
      {
        count: 2
      }
    );

    clearStorage(store);
    store.trigger.add({ amount: 7 });
    expect(JSON.parse(storage.getItem('counter') as string)).toEqual({
      events: [{ type: 'add', amount: 7 }],
      checkpoint: { count: 10 },
      version: 0
    });
    for (const amount of [11, 13]) {
      store.trigger.add({ amount });
    }

    expect(JSON.parse(storage.getItem('counter') as string)).toEqual({
      events: [
        { type: 'add', amount: 11 },
        { type: 'add', amount: 13 }
      ],
      checkpoint: { count: 17 },
      version: 0
    });
    expect(createCounter(storage).getSnapshot().context).toEqual({ count: 41 });
  });

  it.each(['can', 'transition'])(
    'does not consume the reset during %s evaluations',
    (evaluation) => {
      const storage = createStorage();
      const store = createCounter(storage);
      store.trigger.add({ amount: 2 });
      clearStorage(store);

      if (evaluation === 'can') {
        expect(store.can.add({ amount: 20 })).toBe(true);
      } else {
        store.transition(store.getSnapshot(), { type: 'add', amount: 30 });
      }
      flushStorage(store);
      expect(storage.getItem('counter')).toBeNull();
      expect(store.getSnapshot().context).toEqual({ count: 2 });

      store.trigger.add({ amount: 3 });
      expect(JSON.parse(storage.getItem('counter') as string)).toEqual({
        events: [{ type: 'add', amount: 3 }],
        checkpoint: { count: 2 },
        version: 0
      });
    }
  );

  it('keeps history cleared when rehydrating empty storage', async () => {
    const storage = createStorage();
    const store = createCounter(storage);
    store.trigger.add({ amount: 2 });
    clearStorage(store);
    await rehydrateStore(store);
    store.trigger.add({ amount: 3 });

    expect(JSON.parse(storage.getItem('counter') as string)).toEqual({
      events: [{ type: 'add', amount: 3 }],
      checkpoint: { count: 2 },
      version: 0
    });
  });

  it('keeps newly hydrated history after clearing an earlier log', async () => {
    const storage = createStorage();
    const store = createCounter(storage);
    store.trigger.add({ amount: 2 });
    clearStorage(store);
    storage.setItem(
      'counter',
      JSON.stringify({
        events: [{ type: 'add', amount: 4 }],
        checkpoint: { count: 10 },
        version: 0
      })
    );

    await rehydrateStore(store);
    store.trigger.add({ amount: 3 });
    expect(JSON.parse(storage.getItem('counter') as string)).toEqual({
      events: [
        { type: 'add', amount: 4 },
        { type: 'add', amount: 3 }
      ],
      checkpoint: { count: 10 },
      version: 0
    });
    expect(createCounter(storage).getSnapshot().context).toEqual({ count: 17 });
  });

  it('starts a fresh log after each clear, including repeated clears without an event', () => {
    const storage = createStorage();
    const store = createCounter(storage);
    store.trigger.add({ amount: 2 });
    clearStorage(store);
    clearStorage(store);
    store.trigger.add({ amount: 3 });
    clearStorage(store);
    store.trigger.add({ amount: 4 });

    expect(JSON.parse(storage.getItem('counter') as string)).toEqual({
      events: [{ type: 'add', amount: 4 }],
      checkpoint: { count: 5 },
      version: 0
    });
    expect(createCounter(storage).getSnapshot().context).toEqual({ count: 9 });
  });

  it.each(['snapshot', 'event'] as const)(
    'invalidates %s persistence effects computed before clearing',
    (strategy) => {
      const storage = createStorage();
      const store = createStore({
        context: { count: 0 },
        on: {
          add: (context, event: { amount: number }) => ({
            count: context.count + event.amount
          })
        }
      }).with(persist({ name: 'counter', storage, strategy }));
      store.trigger.add({ amount: 2 });
      const [, effects] = store.transition(store.getSnapshot(), {
        type: 'add',
        amount: 10
      });

      clearStorage(store);
      for (const effect of effects) {
        if (typeof effect === 'function') {
          effect();
        }
      }
      expect(storage.getItem('counter')).toBeNull();

      store.trigger.add({ amount: 3 });
      expect(JSON.parse(storage.getItem('counter') as string)).toEqual(
        strategy === 'event'
          ? {
              events: [{ type: 'add', amount: 3 }],
              checkpoint: { count: 2 },
              version: 0
            }
          : { context: { count: 5 }, version: 0 }
      );
    }
  );

  it.each(['snapshot', 'event'] as const)(
    'discards a %s read that started before clearing',
    async (strategy) => {
      const values = new Map<string, string>();
      let deferReads = false;
      let finishRead!: () => void;
      const storage: StateStorage = {
        getItem: (name) => {
          const value = values.get(name) ?? null;
          if (!deferReads) return value;
          return new Promise<string | null>((resolve) => {
            finishRead = () => resolve(value);
          });
        },
        setItem: (name, value) => {
          values.set(name, value);
        },
        removeItem: (name) => {
          values.delete(name);
        }
      };
      const store = createStore({
        context: { count: 0 },
        on: {
          add: (context, event: { amount: number }) => ({
            count: context.count + event.amount
          })
        }
      }).with(persist({ name: 'counter', storage, strategy }));
      store.trigger.add({ amount: 2 });

      // The read captures the pre-clear value, then resolves after clearing.
      deferReads = true;
      const hydrating = rehydrateStore(store);
      clearStorage(store);
      store.trigger.add({ amount: 5 });
      deferReads = false;
      finishRead();
      await hydrating;

      expect(store.getSnapshot().context).toEqual({ count: 7 });
      store.trigger.add({ amount: 3 });
      expect(JSON.parse(storage.getItem('counter') as string)).toEqual(
        strategy === 'event'
          ? {
              events: [
                { type: 'add', amount: 5 },
                { type: 'add', amount: 3 }
              ],
              checkpoint: { count: 2 },
              version: 0
            }
          : { context: { count: 10 }, version: 0 }
      );
    }
  );

  it.each(['snapshot', 'event'] as const)(
    'does not restore a pre-clear %s from its deferred persistence effect',
    (strategy) => {
      const storage = createStorage();
      const store = createStore({
        context: { count: 0 },
        on: {
          add: (context, event: { amount: number }) => ({
            count: context.count + event.amount
          })
        }
      }).with(persist({ name: 'counter', storage, strategy }));
      const subscription = store.subscribe((snapshot) => {
        if (snapshot.context.count === 2) {
          clearStorage(store);
        }
      });

      store.trigger.add({ amount: 2 });
      subscription.unsubscribe();
      flushStorage(store);
      expect(storage.getItem('counter')).toBeNull();

      store.trigger.add({ amount: 3 });
      expect(JSON.parse(storage.getItem('counter') as string)).toEqual(
        strategy === 'event'
          ? {
              events: [{ type: 'add', amount: 3 }],
              checkpoint: { count: 2 },
              version: 0
            }
          : { context: { count: 5 }, version: 0 }
      );
    }
  );

  it('orders new history after an in-flight write and asynchronous removal', async () => {
    const operations: string[] = [];
    let saved: string | null = null;
    let finishFirstWrite!: () => void;
    let finishRemoval!: () => void;
    let startedRemoval!: () => void;
    const removalStarted = new Promise<void>((resolve) => {
      startedRemoval = resolve;
    });
    let firstWrite = true;
    const storage: StateStorage = {
      getItem: () => saved,
      setItem: (_name, value) => {
        operations.push(`write ${JSON.parse(value).events[0].amount}`);
        if (firstWrite) {
          firstWrite = false;
          return new Promise<void>((resolve) => {
            finishFirstWrite = () => {
              saved = value;
              resolve();
            };
          });
        }
        saved = value;
      },
      removeItem: () => {
        operations.push('clear');
        return new Promise<void>((resolve) => {
          finishRemoval = () => {
            saved = null;
            resolve();
          };
          startedRemoval();
        });
      }
    };
    const store = createCounter(storage);
    store.trigger.add({ amount: 2 });
    const cleared = clearStorage(store);
    store.trigger.add({ amount: 3 });
    expect(operations).toEqual(['write 2']);

    finishFirstWrite();
    await removalStarted;
    expect(operations).toEqual(['write 2', 'clear']);
    finishRemoval();
    await cleared;
    await flushStorage(store);

    expect(operations).toEqual(['write 2', 'clear', 'write 3']);
    expect(JSON.parse(storage.getItem('counter') as string)).toEqual({
      events: [{ type: 'add', amount: 3 }],
      checkpoint: { count: 2 },
      version: 0
    });
    expect(createCounter(storage).getSnapshot().context).toEqual({ count: 5 });
  });
});
