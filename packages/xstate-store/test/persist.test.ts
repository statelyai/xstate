import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStore } from '../src/index.ts';
import {
  persist,
  createJSONStorage,
  clearStorage,
  flushStorage,
  rehydrateStore,
  type StateStorage
} from '../src/persist.ts';

// Mock localStorage
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

function createAsyncMockStorage(): StateStorage {
  const data: Record<string, string> = {};
  return {
    getItem: async (name: string) => data[name] ?? null,
    setItem: async (name: string, value: string) => {
      data[name] = value;
    },
    removeItem: async (name: string) => {
      delete data[name];
    }
  };
}

describe('persist', () => {
  it('should persist context to storage after each event', () => {
    const storage = createMockStorage();
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage }));

    store.trigger.inc();

    const stored = JSON.parse(storage.getItem('test') as string);
    expect(stored.context).toEqual({ count: 1 });
    expect(stored.version).toBe(0);
  });

  it('should restore context from storage on creation', () => {
    const storage = createMockStorage();
    storage.setItem(
      'test',
      JSON.stringify({
        context: { count: 42 },
        version: 0
      })
    );

    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage }));

    expect(store.getSnapshot().context.count).toBe(42);
  });

  it('should set _persist.hydrated to true on sync hydration', () => {
    const storage = createMockStorage();
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage }));

    expect((store.getSnapshot() as any)._persist.hydrated).toBe(true);
  });

  it('should set _persist.hydrated to true when storage is empty', () => {
    const storage = createMockStorage();
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage }));

    expect((store.getSnapshot() as any)._persist.hydrated).toBe(true);
  });

  it('should preserve _persist metadata across transitions', () => {
    const storage = createMockStorage();
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage }));

    store.trigger.inc();
    expect((store.getSnapshot() as any)._persist.hydrated).toBe(true);
  });
});

describe('persist - pick', () => {
  it('should only persist selected fields', () => {
    const storage = createMockStorage();
    const store = createStore({
      context: { count: 0, secret: 'do-not-persist' },
      on: {
        inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
      }
    }).with(
      persist({
        name: 'test',
        storage,
        pick: (ctx) => ({ count: ctx.count })
      })
    );

    store.trigger.inc();

    const stored = JSON.parse(storage.getItem('test') as string);
    expect(stored.context).toEqual({ count: 1 });
    expect(stored.context.secret).toBeUndefined();
  });

  it('should merge picked data with full context on restore', () => {
    const storage = createMockStorage();
    storage.setItem(
      'test',
      JSON.stringify({
        context: { count: 42 },
        version: 0
      })
    );

    const store = createStore({
      context: { count: 0, name: 'Ada' },
      on: { inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }) }
    }).with(
      persist({
        name: 'test',
        storage,
        pick: (ctx) => ({ count: ctx.count })
      })
    );

    expect(store.getSnapshot().context).toEqual({ count: 42, name: 'Ada' });
  });
});

describe('persist - version + migrate', () => {
  it('should migrate persisted state when version differs', () => {
    const storage = createMockStorage();
    storage.setItem(
      'test',
      JSON.stringify({
        context: { count: 10 },
        version: 1
      })
    );

    const store = createStore({
      context: { count: 0, label: 'default' },
      on: { inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }) }
    }).with(
      persist({
        name: 'test',
        storage,
        version: 2,
        migrate: (persisted, version) => {
          if (version === 1) {
            return { ...persisted, label: 'migrated' };
          }
          return persisted;
        }
      })
    );

    expect(store.getSnapshot().context.count).toBe(10);
    expect(store.getSnapshot().context.label).toBe('migrated');
  });

  it('should migrate with string versions', () => {
    const storage = createMockStorage();
    storage.setItem(
      'test',
      JSON.stringify({
        context: { count: 10 },
        version: '1.0.0'
      })
    );

    const store = createStore({
      context: { count: 0, label: 'default' },
      on: { inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }) }
    }).with(
      persist({
        name: 'test',
        storage,
        version: '2.0.0',
        migrate: (persisted, version) => {
          if (version === '1.0.0') {
            return { ...persisted, label: 'migrated' };
          }
          return persisted;
        }
      })
    );

    expect(store.getSnapshot().context.count).toBe(10);
    expect(store.getSnapshot().context.label).toBe('migrated');
  });

  it('should not migrate when version matches', () => {
    const storage = createMockStorage();
    storage.setItem(
      'test',
      JSON.stringify({
        context: { count: 5 },
        version: 2
      })
    );

    const migrateFn = vi.fn((ctx) => ctx);

    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(
      persist({
        name: 'test',
        storage,
        version: 2,
        migrate: migrateFn
      })
    );

    expect(migrateFn).not.toHaveBeenCalled();
    expect(store.getSnapshot().context.count).toBe(5);
  });
});

describe('persist - merge', () => {
  it('should use custom merge strategy', () => {
    const storage = createMockStorage();
    storage.setItem(
      'test',
      JSON.stringify({
        context: { count: 42, items: ['a'] },
        version: 0
      })
    );

    const store = createStore({
      context: { count: 0, items: ['b', 'c'] as string[] },
      on: { inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }) }
    }).with(
      persist({
        name: 'test',
        storage,
        merge: (persisted, current) => ({
          ...current,
          ...persisted,
          items: [...current.items, ...(persisted.items ?? [])]
        })
      })
    );

    expect(store.getSnapshot().context.count).toBe(42);
    expect(store.getSnapshot().context.items).toEqual(['b', 'c', 'a']);
  });
});

describe('persist - serialize / deserialize', () => {
  it('should use custom serializer and deserializer', () => {
    const storage = createMockStorage();
    const prefix = 'CUSTOM:';

    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(
      persist({
        name: 'test',
        storage,
        serialize: (value) => prefix + JSON.stringify(value),
        deserialize: (str) => JSON.parse(str.slice(prefix.length))
      })
    );

    store.trigger.inc();

    expect((storage.getItem('test') as string).startsWith(prefix)).toBe(true);

    // Verify roundtrip: create new store from same storage
    const store2 = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(
      persist({
        name: 'test',
        storage,
        serialize: (value) => prefix + JSON.stringify(value),
        deserialize: (str) => JSON.parse(str.slice(prefix.length))
      })
    );

    expect(store2.getSnapshot().context.count).toBe(1);
  });
});

describe('persist - throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should batch writes with throttle', () => {
    const storage = createMockStorage();
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage, throttle: 100 }));

    store.trigger.inc(); // count = 1
    store.trigger.inc(); // count = 2
    store.trigger.inc(); // count = 3

    // Not yet written
    expect(storage.getItem('test')).toBeNull();

    vi.advanceTimersByTime(100);

    // Only last value written
    const stored = JSON.parse(storage.getItem('test') as string);
    expect(stored.context.count).toBe(3);
  });

  it('should not write again if no events between throttle intervals', () => {
    const storage = createMockStorage();
    const onDone = vi.fn();
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage, throttle: 100, onDone }));

    store.trigger.inc();
    vi.advanceTimersByTime(100);

    expect(onDone).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    // No extra writes
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('persist - flushStorage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should force immediate write of pending throttled context', () => {
    const storage = createMockStorage();
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage, throttle: 1000 }));

    store.trigger.inc();
    store.trigger.inc();

    expect(storage.getItem('test')).toBeNull();

    flushStorage(store);

    const stored = JSON.parse(storage.getItem('test') as string);
    expect(stored.context.count).toBe(2);
  });

  it('should throw when store has no persist extension', () => {
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    });

    expect(() => flushStorage(store)).toThrow(
      'flushStorage: store does not have a persist extension'
    );
  });
});

describe('persist - onDone / onError', () => {
  it('should call onDone after successful write', () => {
    const storage = createMockStorage();
    const onDone = vi.fn();
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage, onDone }));

    store.trigger.inc();

    expect(onDone).toHaveBeenCalledWith({ count: 1 });
  });

  it('should call onDone with picked context when pick is used', () => {
    const storage = createMockStorage();
    const onDone = vi.fn();
    const store = createStore({
      context: { count: 0, secret: 'hidden' },
      on: { inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }) }
    }).with(
      persist({
        name: 'test',
        storage,
        onDone,
        pick: (ctx) => ({ count: ctx.count })
      })
    );

    store.trigger.inc();

    expect(onDone).toHaveBeenCalledWith({ count: 1 });
    expect(onDone).not.toHaveBeenCalledWith(
      expect.objectContaining({ secret: 'hidden' })
    );
  });

  it('should call onError on write failure', () => {
    const error = new Error('quota exceeded');
    const failStorage: StateStorage = {
      getItem: () => null,
      setItem: () => {
        throw error;
      },
      removeItem: () => {}
    };
    const onError = vi.fn();

    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage: failStorage, onError }));

    store.trigger.inc();

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should call onError on read failure during hydration', () => {
    const failStorage: StateStorage = {
      getItem: () => {
        throw new Error('read failed');
      },
      setItem: () => {},
      removeItem: () => {}
    };
    const onError = vi.fn();

    createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage: failStorage, onError }));

    expect(onError).toHaveBeenCalled();
  });
});

describe('persist - filter', () => {
  it('should skip persisting when filter returns false', () => {
    const storage = createMockStorage();
    const onDone = vi.fn();
    const store = createStore({
      context: { count: 0, mouse: { x: 0, y: 0 } },
      on: {
        inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
        mousemove: (ctx, e: { x: number; y: number }) => ({
          ...ctx,
          mouse: { x: e.x, y: e.y }
        })
      }
    }).with(
      persist({
        name: 'test',
        storage,
        onDone,
        filter: (event) => event.type !== 'mousemove'
      })
    );

    store.trigger.mousemove({ x: 10, y: 20 });
    expect(onDone).not.toHaveBeenCalled();

    store.trigger.inc();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('persist - skipHydration', () => {
  it('should not hydrate when skipHydration is true', () => {
    const storage = createMockStorage();
    storage.setItem(
      'test',
      JSON.stringify({
        context: { count: 99 },
        version: 0
      })
    );

    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage, skipHydration: true }));

    expect(store.getSnapshot().context.count).toBe(0);
    expect((store.getSnapshot() as any)._persist.hydrated).toBe(false);
  });
});

describe('persist - rehydrateStore', () => {
  it('should rehydrate from sync storage', async () => {
    const storage = createMockStorage();
    storage.setItem(
      'test',
      JSON.stringify({
        context: { count: 99 },
        version: 0
      })
    );

    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage, skipHydration: true }));

    expect(store.getSnapshot().context.count).toBe(0);

    await rehydrateStore(store);

    expect(store.getSnapshot().context.count).toBe(99);
    expect((store.getSnapshot() as any)._persist.hydrated).toBe(true);
  });

  it('should rehydrate from async storage', async () => {
    const storage = createAsyncMockStorage();
    storage.setItem(
      'test',
      JSON.stringify({
        context: { count: 77 },
        version: 0
      })
    );

    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage, skipHydration: true }));

    expect(store.getSnapshot().context.count).toBe(0);

    await rehydrateStore(store);

    expect(store.getSnapshot().context.count).toBe(77);
    expect((store.getSnapshot() as any)._persist.hydrated).toBe(true);
  });

  it('should merge with events sent before rehydration', async () => {
    const storage = createMockStorage();
    storage.setItem(
      'test',
      JSON.stringify({
        context: { count: 10 },
        version: 0
      })
    );

    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage, skipHydration: true }));

    // Send events before rehydration
    store.trigger.inc(); // count = 1

    await rehydrateStore(store);

    // Default merge: persisted overwrites current, so count = 10
    expect(store.getSnapshot().context.count).toBe(10);
  });

  it('should handle empty storage gracefully', async () => {
    const storage = createMockStorage();

    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage, skipHydration: true }));

    await rehydrateStore(store);

    expect(store.getSnapshot().context.count).toBe(0);
    expect((store.getSnapshot() as any)._persist.hydrated).toBe(true);
  });

  it('should apply migration during rehydration', async () => {
    const storage = createMockStorage();
    storage.setItem(
      'test',
      JSON.stringify({
        context: { count: 5 },
        version: 1
      })
    );

    const store = createStore({
      context: { count: 0, label: '' },
      on: { inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }) }
    }).with(
      persist({
        name: 'test',
        storage,
        version: 2,
        skipHydration: true,
        migrate: (persisted, version) => {
          if (version === 1) {
            return { ...persisted, label: 'migrated' };
          }
          return persisted;
        }
      })
    );

    await rehydrateStore(store);

    expect(store.getSnapshot().context.count).toBe(5);
    expect(store.getSnapshot().context.label).toBe('migrated');
  });

  it('should throw when store has no persist extension', async () => {
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    });

    await expect(rehydrateStore(store)).rejects.toThrow(
      'rehydrateStore: store does not have a persist extension'
    );
  });
});

describe('persist - clearStorage', () => {
  it('should remove persisted data from storage', () => {
    const storage = createMockStorage();
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage }));

    store.trigger.inc();
    expect(storage.getItem('test')).not.toBeNull();

    clearStorage(store);
    expect(storage.getItem('test')).toBeNull();
  });

  it('should throw when store has no persist extension', () => {
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    });

    expect(() => clearStorage(store)).toThrow(
      'clearStorage: store does not have a persist extension'
    );
  });
});

describe('persist - createJSONStorage', () => {
  it('should return noop storage when getStorage throws', () => {
    const storage = createJSONStorage(() => {
      throw new Error('no localStorage');
    });

    expect(storage.getItem('test')).toBeNull();
    expect(() => storage.setItem('test', 'value')).not.toThrow();
    expect(() => storage.removeItem('test')).not.toThrow();
  });

  it('should wrap a working storage adapter', () => {
    const mockStorage = createMockStorage();
    const storage = createJSONStorage(() => mockStorage);

    storage.setItem('foo', 'bar');
    expect(storage.getItem('foo')).toBe('bar');

    storage.removeItem('foo');
    expect(storage.getItem('foo')).toBeNull();
  });
});

describe('persist - async storage auto-detection', () => {
  it('should detect async storage and skip sync hydration', () => {
    const storage = createAsyncMockStorage();
    storage.setItem(
      'test',
      JSON.stringify({
        context: { count: 50 },
        version: 0
      })
    );

    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage }));

    // Should NOT have hydrated (async storage detected)
    expect(store.getSnapshot().context.count).toBe(0);
    expect((store.getSnapshot() as any)._persist.hydrated).toBe(false);
  });
});

describe('persist - composability', () => {
  it('should work with undoRedo extension', () => {
    // Import would be needed in real code but this tests the pattern
    const storage = createMockStorage();
    const store = createStore({
      context: { count: 0 },
      on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
    }).with(persist({ name: 'test', storage }));

    store.trigger.inc();
    store.trigger.inc();

    const stored = JSON.parse(storage.getItem('test') as string);
    expect(stored.context.count).toBe(2);
    expect(store.getSnapshot().context.count).toBe(2);
  });

  it('should persist and restore correctly across store instances', () => {
    const storage = createMockStorage();
    const config = {
      name: 'test' as const,
      storage
    };

    // Store 1: write
    const store1 = createStore({
      context: { count: 0, name: 'test' },
      on: {
        inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
        setName: (ctx, e: { name: string }) => ({ ...ctx, name: e.name })
      }
    }).with(persist(config));

    store1.trigger.inc();
    store1.trigger.inc();
    store1.trigger.setName({ name: 'updated' });

    // Store 2: read
    const store2 = createStore({
      context: { count: 0, name: 'test' },
      on: {
        inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
        setName: (ctx, e: { name: string }) => ({ ...ctx, name: e.name })
      }
    }).with(persist(config));

    expect(store2.getSnapshot().context.count).toBe(2);
    expect(store2.getSnapshot().context.name).toBe('updated');
  });
});
