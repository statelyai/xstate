import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStore } from '../src/index.ts';
import {
  createBroadcastStorage,
  persist,
  subscribeToBroadcastStorage,
  type StateStorage
} from '../src/persist.ts';

type Listener = (event: { data: unknown }) => void;

const channels = new Map<string, Set<MockBroadcastChannel>>();

class MockBroadcastChannel {
  public listeners = new Set<Listener>();

  constructor(public name: string) {
    let entries = channels.get(name);
    if (!entries) {
      entries = new Set();
      channels.set(name, entries);
    }
    entries.add(this);
  }

  postMessage(data: unknown) {
    const entries = channels.get(this.name);
    if (!entries) {
      return;
    }

    for (const channel of entries) {
      if (channel === this) {
        continue;
      }

      for (const listener of channel.listeners) {
        listener({ data });
      }
    }
  }

  addEventListener(_type: 'message', listener: Listener) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: Listener) {
    this.listeners.delete(listener);
  }

  close() {
    channels.get(this.name)?.delete(this);
    this.listeners.clear();
  }
}

function createMemoryStorage(): StateStorage {
  const data: Record<string, string> = {};

  return {
    getItem: (name) => data[name] ?? null,
    setItem: (name, value) => {
      data[name] = value;
    },
    removeItem: (name) => {
      delete data[name];
    }
  };
}

function createCounterStore(storage: StateStorage) {
  return createStore({
    context: { count: 0 },
    on: {
      inc: (context) => ({ count: context.count + 1 })
    }
  }).with(persist({ name: 'counter', storage }));
}

function waitForMicrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('broadcast storage', () => {
  beforeEach(() => {
    channels.clear();
    (globalThis as any).BroadcastChannel = MockBroadcastChannel;
  });

  afterEach(() => {
    channels.clear();
    delete (globalThis as any).BroadcastChannel;
  });

  it('broadcasts writes to other storage adapters on the same channel', () => {
    const baseStorage = createMemoryStorage();
    const storage = createBroadcastStorage(baseStorage);
    const receiver = new MockBroadcastChannel('xstate-store');
    const messages: unknown[] = [];

    receiver.addEventListener('message', (event) => {
      messages.push(event.data);
    });

    storage.setItem('counter', JSON.stringify({ context: { count: 1 } }));

    expect(messages).toEqual([
      { type: 'xstate-store-update', name: 'counter' }
    ]);
  });

  it('rehydrates subscribed stores when another tab writes persisted state', async () => {
    const baseStorage = createMemoryStorage();
    const storage1 = createBroadcastStorage(baseStorage);
    const storage2 = createBroadcastStorage(baseStorage);
    const store1 = createCounterStore(storage1);
    const store2 = createCounterStore(storage2);
    const unsubscribe = subscribeToBroadcastStorage(store2);

    store1.trigger.inc();
    await waitForMicrotask();

    expect(store1.getSnapshot().context.count).toBe(1);
    expect(store2.getSnapshot().context.count).toBe(1);

    unsubscribe();
  });

  it('does not rehydrate from unrelated storage names', async () => {
    const baseStorage = createMemoryStorage();
    const storage = createBroadcastStorage(baseStorage);
    const store = createCounterStore(storage);
    const unsubscribe = subscribeToBroadcastStorage(store);
    const sender = new MockBroadcastChannel('xstate-store');

    baseStorage.setItem(
      'other',
      JSON.stringify({ context: { count: 100 }, version: 0 })
    );
    sender.postMessage({ type: 'xstate-store-update', name: 'other' });
    await waitForMicrotask();

    expect(store.getSnapshot().context.count).toBe(0);

    unsubscribe();
    sender.close();
  });

  it('throws when subscribing a store without broadcast storage', () => {
    const store = createCounterStore(createMemoryStorage());

    expect(() => subscribeToBroadcastStorage(store)).toThrow(
      'subscribeToBroadcastStorage: store storage must be wrapped with createBroadcastStorage()'
    );
  });
});
