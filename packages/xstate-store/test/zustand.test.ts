import { createStoreFromZustand } from '../src/zustand.ts';

describe('createStoreFromZustand', () => {
  it('creates a store from a zustand-style creator', () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      increment: (qty: number) =>
        set((state) => ({ count: state.count + qty })),
      decrement: (qty: number) => set((state) => ({ count: state.count - qty }))
    }));

    expect(store.getSnapshot().context).toEqual({ count: 0 });

    store.trigger.increment(1);
    expect(store.getSnapshot().context).toEqual({ count: 1 });

    store.trigger.decrement(3);
    expect(store.getSnapshot().context).toEqual({ count: -2 });
  });

  it('separates context from actions (no functions in context)', () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      name: 'test',
      increment: () => set({ count: 1 })
    }));

    const ctx = store.getSnapshot().context;
    expect(ctx).toEqual({ count: 0, name: 'test' });
    expect(typeof (ctx as any).increment).toBe('undefined');
  });

  it('handles no-arg actions', () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      reset: () => set({ count: 0 }),
      increment: () => set((s) => ({ count: s.count + 1 }))
    }));

    store.trigger.increment();
    store.trigger.increment();
    expect(store.getSnapshot().context.count).toBe(2);

    store.trigger.reset();
    expect(store.getSnapshot().context.count).toBe(0);
  });

  it('merges multiple sync set calls', () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      name: 'initial',
      updateBoth: () => {
        set({ count: 42 });
        set({ name: 'updated' });
      }
    }));

    store.trigger.updateBoth();
    expect(store.getSnapshot().context).toEqual({
      count: 42,
      name: 'updated'
    });
  });

  it('handles set with partial object (not updater function)', () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      name: 'test',
      setCount: (n: number) => set({ count: n })
    }));

    store.trigger.setCount(99);
    expect(store.getSnapshot().context).toEqual({ count: 99, name: 'test' });
  });

  it('handles set with updater function', () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      increment: (by: number) =>
        set((state) => ({ ...state, count: state.count + by }))
    }));

    store.trigger.increment(5);
    expect(store.getSnapshot().context.count).toBe(5);

    store.trigger.increment(3);
    expect(store.getSnapshot().context.count).toBe(8);
  });

  it('handles replace flag in sync phase', () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      name: 'initial',
      replaceAll: () => set({ count: 99 } as any, true)
    }));

    store.trigger.replaceAll();
    // replace=true should replace the entire captured context
    expect(store.getSnapshot().context).toEqual({ count: 99 });
  });

  it('filters functions from set() partial', () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      setWithFn: () => set({ count: 1, helper: () => {} } as any)
    }));

    store.trigger.setWithFn();
    expect(store.getSnapshot().context).toEqual({ count: 1 });
    expect(typeof (store.getSnapshot().context as any).helper).toBe(
      'undefined'
    );
  });

  it('get() returns context + action functions', () => {
    let capturedGet: (() => any) | null = null;

    const store = createStoreFromZustand((set, get) => {
      capturedGet = get;
      return {
        count: 0,
        increment: () => set({ count: get().count + 1 })
      };
    });

    // get() should include action functions
    const state = capturedGet!();
    expect(state.count).toBe(0);
    expect(typeof state.increment).toBe('function');
  });

  it('get() inside action reflects current committed state', () => {
    const store = createStoreFromZustand((set, get) => ({
      count: 0,
      doubleCount: () => {
        const current = get().count;
        set({ count: current * 2 });
      },
      increment: () => set((s) => ({ count: s.count + 1 }))
    }));

    store.trigger.increment();
    store.trigger.increment();
    expect(store.getSnapshot().context.count).toBe(2);

    store.trigger.doubleCount();
    expect(store.getSnapshot().context.count).toBe(4);
  });

  it('notifies subscribers on sync updates', () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 }))
    }));

    const snapshots: any[] = [];
    store.subscribe((snapshot) => {
      snapshots.push(snapshot.context);
    });

    store.trigger.increment();
    store.trigger.increment();

    expect(snapshots).toEqual([{ count: 1 }, { count: 2 }]);
  });

  it('handles async set via dangerouslySet event', async () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      loading: false,
      fetchAndSet: async () => {
        set({ loading: true });
        await Promise.resolve();
        set({ count: 42, loading: false });
      }
    }));

    store.trigger.fetchAndSet();

    // Sync set is captured immediately
    expect(store.getSnapshot().context).toEqual({
      count: 0,
      loading: true
    });

    // Wait for async set
    await new Promise((r) => setTimeout(r, 10));

    expect(store.getSnapshot().context).toEqual({
      count: 42,
      loading: false
    });
  });

  it('async set notifies subscribers', async () => {
    const store = createStoreFromZustand((set) => ({
      value: 'initial',
      asyncUpdate: async () => {
        await Promise.resolve();
        set({ value: 'updated' });
      }
    }));

    const values: string[] = [];
    store.subscribe((s) => values.push(s.context.value));

    store.trigger.asyncUpdate();
    await new Promise((r) => setTimeout(r, 10));

    expect(values).toContain('updated');
  });

  it('works with store.send()', () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      increment: (qty: number) => set((s) => ({ count: s.count + qty }))
    }));

    store.send({ type: 'increment', args: [5] } as any);
    expect(store.getSnapshot().context.count).toBe(5);
  });

  it('works with .select()', () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      name: 'test',
      increment: () => set((s) => ({ ...s, count: s.count + 1 }))
    }));

    const countSelection = store.select((ctx) => ctx.count);
    expect(countSelection.get()).toBe(0);

    store.trigger.increment();
    expect(countSelection.get()).toBe(1);
  });

  it('works with getInitialSnapshot()', () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 }))
    }));

    store.trigger.increment();
    store.trigger.increment();

    expect(store.getInitialSnapshot().context).toEqual({ count: 0 });
    expect(store.getSnapshot().context).toEqual({ count: 2 });
  });

  it('handles actions with multiple arguments', () => {
    const store = createStoreFromZustand((set) => ({
      result: '',
      combine: (a: string, b: string, c: number) =>
        set({ result: `${a}-${b}-${c}` })
    }));

    store.trigger.combine('hello', 'world', 42);
    expect(store.getSnapshot().context.result).toBe('hello-world-42');
  });

  it('handles action that does not call set', () => {
    let sideEffect = false;

    const store = createStoreFromZustand((set) => ({
      count: 0,
      sideEffectOnly: () => {
        sideEffect = true;
      },
      increment: () => set((s) => ({ count: s.count + 1 }))
    }));

    store.trigger.sideEffectOnly();
    expect(sideEffect).toBe(true);
    expect(store.getSnapshot().context.count).toBe(0);
  });

  it('concurrent async actions resolve independently', async () => {
    const store = createStoreFromZustand((set) => ({
      a: 0,
      b: 0,
      setA: async () => {
        await new Promise((r) => setTimeout(r, 5));
        set({ a: 1 });
      },
      setB: async () => {
        await new Promise((r) => setTimeout(r, 10));
        set({ b: 1 });
      }
    }));

    store.trigger.setA();
    store.trigger.setB();

    await new Promise((r) => setTimeout(r, 20));

    expect(store.getSnapshot().context).toEqual({ a: 1, b: 1 });
  });

  it('store.trigger.dangerouslySet works for external set', () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 }))
    }));

    store.trigger.dangerouslySet({ partial: { count: 99 }, replace: false });
    expect(store.getSnapshot().context).toEqual({ count: 99 });
  });

  it('store.trigger.dangerouslySet with replace=true', () => {
    const store = createStoreFromZustand((set) => ({
      count: 0,
      name: 'test',
      noop: () => {}
    }));

    store.trigger.dangerouslySet({
      partial: { count: 42 } as any,
      replace: true
    });
    expect(store.getSnapshot().context).toEqual({ count: 42 });
  });

  it('set() during init updates initial context', () => {
    const store = createStoreFromZustand((set) => {
      // set called during creator body (init phase)
      set({ count: 10 });
      return {
        count: 0,
        name: 'test',
        increment: () => set((s) => ({ count: s.count + 1 }))
      };
    });

    // The creator returns count: 0 which overwrites the set({count: 10}),
    // but name should be 'test'
    expect(store.getSnapshot().context).toEqual({ count: 0, name: 'test' });
  });

  it('set() during init does not crash (no storeRef)', () => {
    // Should not throw
    const store = createStoreFromZustand((set) => {
      set({ initialized: true });
      return {
        initialized: false,
        value: 'hello',
        update: () => set({ value: 'updated' })
      };
    });

    // Creator return values overwrite init set() values
    expect(store.getSnapshot().context.initialized).toBe(false);
    store.trigger.update();
    expect(store.getSnapshot().context.value).toBe('updated');
  });

  it('set() during init with values not in return is preserved', () => {
    const store = createStoreFromZustand((set) => {
      set({ extra: 'from-init' } as any);
      return {
        count: 0,
        increment: () => set((s) => ({ count: s.count + 1 }))
      };
    });

    // 'extra' was set during init and not overwritten by return
    expect((store.getSnapshot().context as any).extra).toBe('from-init');
  });

  it('api third parameter provides setState/getState', () => {
    let capturedApi: any = null;

    const store = createStoreFromZustand((set, get, api) => {
      capturedApi = api;
      return {
        count: 0,
        increment: () => set((s) => ({ count: s.count + 1 }))
      };
    });

    expect(typeof capturedApi.setState).toBe('function');
    expect(typeof capturedApi.getState).toBe('function');
    expect(typeof capturedApi.getInitialState).toBe('function');
    expect(typeof capturedApi.subscribe).toBe('function');

    // getState works
    store.trigger.increment();
    expect(capturedApi.getState().count).toBe(1);
  });

  it('api.subscribe notifies on changes', () => {
    let capturedApi: any = null;

    const store = createStoreFromZustand((set, get, api) => {
      capturedApi = api;
      return {
        count: 0,
        increment: () => set((s) => ({ count: s.count + 1 }))
      };
    });

    const states: any[] = [];
    capturedApi.subscribe((state: any, prev: any) => {
      states.push({ state: state.count, prev: prev.count });
    });

    store.trigger.increment();
    store.trigger.increment();

    expect(states).toEqual([
      { state: 1, prev: 0 },
      { state: 2, prev: 1 }
    ]);
  });

  it('api.subscribe during init returns no-op unsubscribe', () => {
    let initUnsub: any = null;

    const store = createStoreFromZustand((set, get, api) => {
      initUnsub = api.subscribe(() => {});
      return {
        count: 0,
        increment: () => set((s) => ({ count: s.count + 1 }))
      };
    });

    // Should be a function (no-op), and calling it should not throw
    expect(typeof initUnsub).toBe('function');
    expect(() => initUnsub()).not.toThrow();
  });
});
