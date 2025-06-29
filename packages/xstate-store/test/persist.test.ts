import { createStore, createStoreConfig } from '../src/store.ts';
import { persist } from '../src/persist.ts';

// Mock localStorage for testing
const mockLocalStorage = {
  data: {} as Record<string, string>,
  getItem: function (key: string) {
    return this.data[key] || null;
  },
  setItem: function (key: string, value: string) {
    this.data[key] = value;
  },
  removeItem: function (key: string) {
    delete this.data[key];
  },
  clear: function () {
    this.data = {};
  }
};

// Mock global localStorage
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Custom storage implementation for testing
const createCustomStorage = (): Storage => {
  const data: Record<string, string> = {};
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
    clear: () => {
      Object.keys(data).forEach((key) => delete data[key]);
    },
    get length() {
      return Object.keys(data).length;
    },
    key: (index: number) => Object.keys(data)[index] ?? null
  };
};

describe('persist', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it('should persist store state to localStorage', () => {
    const storeConfig = createStoreConfig({
      context: { count: 0 },
      on: {
        increment: (context) => ({
          count: context.count + 1
        }),
        decrement: (context) => ({
          count: context.count - 1
        })
      }
    });

    const persistedStore = persist(storeConfig, { name: 'test-store' });
    const store = createStore(persistedStore);

    // Initial state should be loaded from localStorage (empty initially)
    expect(store.getSnapshot().context).toEqual({ count: 0 });

    // Send an event
    store.send({ type: 'increment' });
    expect(store.getSnapshot().context).toEqual({ count: 1 });

    // Check that state was saved to localStorage
    const saved = JSON.parse(mockLocalStorage.getItem('test-store') || '{}');
    expect(saved.context).toEqual({ count: 1 });
  });

  it('should load persisted state on initialization', () => {
    // Pre-populate localStorage
    const savedState = {
      status: 'active',
      context: { count: 42 },
      output: undefined,
      error: undefined
    };
    mockLocalStorage.setItem('test-store', JSON.stringify(savedState));

    const storeConfig = createStoreConfig({
      context: { count: 0 },
      on: {
        increment: (context) => ({
          count: context.count + 1
        })
      }
    });

    const persistedStore = persist(storeConfig, { name: 'test-store' });
    const store = createStore(persistedStore);

    // Should load the persisted state
    expect(store.getSnapshot().context).toEqual({ count: 42 });
  });

  it('should work with custom serializer', () => {
    const customSerializer = {
      serialize: (value: any) => btoa(JSON.stringify(value)), // Base64 encode
      deserialize: (value: string) => JSON.parse(atob(value)) // Base64 decode
    };

    const storeConfig = createStoreConfig({
      context: { count: 0 },
      on: {
        increment: (context) => ({
          count: context.count + 1
        })
      }
    });

    const persistedStore = persist(storeConfig, {
      name: 'test-store',
      serializer: customSerializer
    });
    const store = createStore(persistedStore);

    store.send({ type: 'increment' });

    // Check that state was saved with custom serializer
    const saved = mockLocalStorage.getItem('test-store');
    expect(saved).toBeTruthy();

    // Decode and verify
    const decoded = customSerializer.deserialize(saved!);
    expect(decoded.context).toEqual({ count: 1 });
  });

  it('should work with custom storage', () => {
    const customStorage = createCustomStorage();

    const storeConfig = createStoreConfig({
      context: { count: 0 },
      on: {
        increment: (context) => ({
          count: context.count + 1
        })
      }
    });

    const persistedStore = persist(storeConfig, {
      name: 'test-store',
      storage: customStorage
    });
    const store = createStore(persistedStore);

    // Initial state should be loaded from custom storage (empty initially)
    expect(store.getSnapshot().context).toEqual({ count: 0 });

    // Send an event
    store.send({ type: 'increment' });
    expect(store.getSnapshot().context).toEqual({ count: 1 });

    // Check that state was saved to custom storage, not localStorage
    const saved = JSON.parse(customStorage.getItem('test-store') || '{}');
    expect(saved.context).toEqual({ count: 1 });

    // Verify localStorage was not used
    expect(mockLocalStorage.getItem('test-store')).toBeNull();
  });

  it('should load persisted state from custom storage on initialization', () => {
    const customStorage = createCustomStorage();

    // Pre-populate custom storage
    const savedState = {
      status: 'active',
      context: { count: 42 },
      output: undefined,
      error: undefined
    };
    customStorage.setItem('test-store', JSON.stringify(savedState));

    const storeConfig = createStoreConfig({
      context: { count: 0 },
      on: {
        increment: (context) => ({
          count: context.count + 1
        })
      }
    });

    const store = createStore(
      persist(storeConfig, {
        name: 'test-store',
        storage: customStorage
      })
    );

    // Should load the persisted state from custom storage
    expect(store.getSnapshot().context).toEqual({ count: 42 });
  });

  it('should work with custom storage and custom serializer together', () => {
    const customStorage = createCustomStorage();
    const customSerializer = {
      serialize: (value: any) => btoa(JSON.stringify(value)),
      deserialize: (value: string) => JSON.parse(atob(value))
    };

    const storeConfig = createStoreConfig({
      context: { count: 0 },
      on: {
        increment: (context) => ({
          count: context.count + 1
        })
      }
    });

    const store = createStore(
      persist(storeConfig, {
        name: 'test-store',
        storage: customStorage,
        serializer: customSerializer
      })
    );

    store.send({ type: 'increment' });

    // Check that state was saved to custom storage with custom serializer
    const saved = customStorage.getItem('test-store');
    expect(saved).toBeTruthy();

    // Decode and verify
    const decoded = customSerializer.deserialize(saved!);
    expect(decoded.context).toEqual({ count: 1 });
  });

  it('should handle custom storage errors gracefully', () => {
    const customStorage = createCustomStorage();

    // Mock custom storage to throw errors
    const originalSetItem = customStorage.setItem;
    customStorage.setItem = () => {
      throw new Error('Custom storage error');
    };

    const storeConfig = createStoreConfig({
      context: { count: 0 },
      on: {
        increment: (context) => ({
          count: context.count + 1
        })
      }
    });

    const persistedStore = persist(storeConfig, {
      name: 'test-store',
      storage: customStorage
    });
    const store = createStore(persistedStore);

    // Should not throw error, just log warning
    expect(() => {
      store.send({ type: 'increment' });
    }).not.toThrow();

    // Restore original function
    customStorage.setItem = originalSetItem;
  });

  it('should handle localStorage errors gracefully', () => {
    // Mock localStorage to throw errors
    const originalSetItem = mockLocalStorage.setItem;
    mockLocalStorage.setItem = () => {
      throw new Error('Storage quota exceeded');
    };

    const storeConfig = createStoreConfig({
      context: { count: 0 },
      on: {
        increment: (context) => ({
          count: context.count + 1
        })
      }
    });

    const persistedStore = persist(storeConfig, { name: 'test-store' });
    const store = createStore(persistedStore);

    // Should not throw error, just log warning
    expect(() => {
      store.send({ type: 'increment' });
    }).not.toThrow();

    // Restore original function
    mockLocalStorage.setItem = originalSetItem;
  });
});
