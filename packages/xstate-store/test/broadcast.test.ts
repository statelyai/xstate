import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStore } from '../src/index.ts';
import {
  persist,
  createBroadcastStorage,
  subscribeToBroadcastStorage,
  type StateStorage
} from '../src/persist.ts';

// Mock localStorage-like storage
function createMockStorage(): StateStorage {
  const data: Record<string, string> = {};
  return {
    getItem: (name: string) => data[name] ?? null,
    setItem: (name: string, value: string) => {
      data[name] = value;
    },
    removeItem: (name: string) => {
      delete data[name];
    }
  };
}

// Minimal BroadcastChannel mock for Node/Vitest
type Listener = (event: { data: any }) => void;
const channelRegistry = new Map<string, Set<{ listeners: Listener[] }>>();

class MockBroadcastChannel {
  name: string;
  private listeners: Listener[] = [];
  private entry: { listeners: Listener[] };

  constructor(name: string) {
    this.name = name;
    this.entry = { listeners: this.listeners };
    if (!channelRegistry.has(name)) {
      channelRegistry.set(name, new Set());
    }
    channelRegistry.get(name)!.add(this.entry);
  }

  postMessage(data: any) {
    const peers = channelRegistry.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer === this.entry) continue; // don't deliver to self
      for (const fn of peer.listeners) {
        fn({ data });
      }
    }
  }

  addEventListener(_type: string, fn: Listener) {
    this.listeners.push(fn);
  }

  removeEventListener(_type: string, fn: Listener) {
    const idx = this.listeners.indexOf(fn);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }

  close() {
    const peers = channelRegistry.get(this.name);
    if (peers) {
      peers.delete(this.entry);
      if (peers.size === 0) channelRegistry.delete(this.name);
    }
    this.listeners.length = 0;
  }
}

// Install the mock globally before tests run
beforeEach(() => {
  (globalThis as any).BroadcastChannel = MockBroadcastChannel;
  channelRegistry.clear();
});

afterEach(() => {
  channelRegistry.clear();
  delete (globalThis as any).BroadcastChannel;
});

describe('createBroadcastStorage', () => {
  it('should delegate getItem to the base storage', () => {
    const base = createMockStorage();
    base.setItem('key', 'value');

    const storage = createBroadcastStorage(base);
    expect(storage.getItem('key')).toBe('value');
  });

  it('should delegate setItem to the base storage', () => {
    const base = createMockStorage();
    const storage = createBroadcastStorage(base);

    storage.setItem('key', 'value');
    expect(base.getItem('key')).toBe('value');
  });

  it('should delegate removeItem to the base storage', () => {
    const base = createMockStorage();
    base.setItem('key', 'value');
    const storage = createBroadcastStorage(base);

    storage.removeItem('key');
    expect(base.getItem('key')).toBeNull();
  });

  it('should expose the underlying BroadcastChannel', () => {
    const base = createMockStorage();
    const storage = createBroadcastStorage(base);
    expect(storage.channel).toBeInstanceOf(MockBroadcastChannel);
  });

  it('should broadcast a message on setItem', () => {
    const base = createMockStorage();
    const storage = createBroadcastStorage(base);

    // Create a second channel on the same name to observe messages
    const receiver = new MockBroadcastChannel('xstate-store');
    const messages: any[] = [];
    receiver.addEventListener('message', (e) => messages.push(e.data));

    storage.setItem('my-store', '{"context":{"count":1},"version":0}');

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      type: 'xstate-store-update',
      name: 'my-store'
    });

    receiver.close();
  });

  it('should use a custom channel name', () => {
    const base = createMockStorage();
    const storage = createBroadcastStorage(base, { channel: 'my-channel' });

    const defaultReceiver = new MockBroadcastChannel('xstate-store');
    const customReceiver = new MockBroadcastChannel('my-channel');
    const defaultMessages: any[] = [];
    const customMessages: any[] = [];

    defaultReceiver.addEventListener('message', (e) =>
      defaultMessages.push(e.data)
    );
    customReceiver.addEventListener('message', (e) =>
      customMessages.push(e.data)
    );

    storage.setItem('test', 'data');

    expect(defaultMessages).toHaveLength(0);
    expect(customMessages).toHaveLength(1);

    defaultReceiver.close();
    customReceiver.close();
  });
});

describe('subscribeToBroadcastStorage', () => {
  it('should rehydrate store when a broadcast is received', () => {
    const base = createMockStorage();
    const storage = createBroadcastStorage(base);

    // Tab 1: creates the store and subscribes
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test-store', storage }));

    const unsub = subscribeToBroadcastStorage(store);

    expect(store.getSnapshot().context.count).toBe(0);

    // Simulate another tab writing to storage and broadcasting
    base.setItem(
      'test-store',
      JSON.stringify({ context: { count: 42 }, version: 0 })
    );
    // The other tab's broadcast storage would post this message:
    storage.channel.postMessage({
      type: 'xstate-store-update',
      name: 'test-store'
    });

    // subscribeToBroadcastStorage calls rehydrateStore which is async
    // but with sync storage the send happens synchronously after await
    // We need to wait a tick for the promise to resolve
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(store.getSnapshot().context.count).toBe(42);
        unsub();
        resolve();
      }, 0);
    });
  });

  it('should not rehydrate for a different store name', () => {
    const base = createMockStorage();
    const storage = createBroadcastStorage(base);

    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'store-a', storage }));

    const unsub = subscribeToBroadcastStorage(store);

    // Broadcast for a different store name
    storage.channel.postMessage({
      type: 'xstate-store-update',
      name: 'store-b'
    });

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(store.getSnapshot().context.count).toBe(0);
        unsub();
        resolve();
      }, 0);
    });
  });

  it('should stop rehydrating after unsubscribe', () => {
    const base = createMockStorage();
    const storage = createBroadcastStorage(base);

    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test-store', storage }));

    const unsub = subscribeToBroadcastStorage(store);
    unsub();

    // Now write and broadcast
    base.setItem(
      'test-store',
      JSON.stringify({ context: { count: 99 }, version: 0 })
    );
    storage.channel.postMessage({
      type: 'xstate-store-update',
      name: 'test-store'
    });

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // Should NOT have rehydrated
        expect(store.getSnapshot().context.count).toBe(0);
        resolve();
      }, 0);
    });
  });

  it('should throw if store has no persist extension', () => {
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    });

    expect(() => subscribeToBroadcastStorage(store)).toThrow(
      'subscribeToBroadcastStorage: store does not have a persist extension'
    );
  });

  it('should use a custom channel name', () => {
    const base = createMockStorage();
    const storage = createBroadcastStorage(base, { channel: 'custom' });

    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test-store', storage }));

    const unsub = subscribeToBroadcastStorage(store, { channel: 'custom' });

    base.setItem(
      'test-store',
      JSON.stringify({ context: { count: 7 }, version: 0 })
    );

    // Broadcast on the custom channel
    const sender = new MockBroadcastChannel('custom');
    sender.postMessage({ type: 'xstate-store-update', name: 'test-store' });

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(store.getSnapshot().context.count).toBe(7);
        unsub();
        sender.close();
        resolve();
      }, 0);
    });
  });

  it('should work with two stores sharing storage (cross-tab sim)', () => {
    const sharedBase = createMockStorage();

    // Tab 1
    const storage1 = createBroadcastStorage(sharedBase);
    const store1 = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'shared', storage: storage1 }));
    const unsub1 = subscribeToBroadcastStorage(store1);

    // Tab 2
    const storage2 = createBroadcastStorage(sharedBase);
    const store2 = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'shared', storage: storage2 }));
    const unsub2 = subscribeToBroadcastStorage(store2);

    // Tab 1 triggers an event — this writes to storage and broadcasts
    store1.trigger.inc();

    expect(store1.getSnapshot().context.count).toBe(1);

    // The broadcast is delivered synchronously in mock but rehydrate is async
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(store2.getSnapshot().context.count).toBe(1);
        unsub1();
        unsub2();
        resolve();
      }, 0);
    });
  });

  it('should handle multiple sequential updates', () => {
    const sharedBase = createMockStorage();
    const storage1 = createBroadcastStorage(sharedBase);
    const storage2 = createBroadcastStorage(sharedBase);

    const store1 = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'shared', storage: storage1 }));

    const store2 = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'shared', storage: storage2 }));
    const unsub2 = subscribeToBroadcastStorage(store2);

    store1.trigger.inc(); // count=1
    store1.trigger.inc(); // count=2
    store1.trigger.inc(); // count=3

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(store2.getSnapshot().context.count).toBe(3);
        unsub2();
        resolve();
      }, 0);
    });
  });

  it('should ignore non-xstate broadcast messages', () => {
    const base = createMockStorage();
    const storage = createBroadcastStorage(base);

    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test-store', storage }));

    const unsub = subscribeToBroadcastStorage(store);

    // Post an unrelated message
    storage.channel.postMessage({ type: 'something-else', name: 'test-store' });
    storage.channel.postMessage('just a string');
    storage.channel.postMessage(null);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(store.getSnapshot().context.count).toBe(0);
        unsub();
        resolve();
      }, 0);
    });
  });
});
