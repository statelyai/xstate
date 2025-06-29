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
      serialize: customSerializer.serialize,
      deserialize: customSerializer.deserialize
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
