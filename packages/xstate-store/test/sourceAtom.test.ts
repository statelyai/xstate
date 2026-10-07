import {
  createAsyncAtom,
  createAtom,
  createSourceAtom,
  createStore
} from '../src/index.ts';

function externalSource<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  const cleanup = vi.fn();
  const subscribe = vi.fn((notify: () => void) => {
    listeners.add(notify);
    return {
      unsubscribe() {
        listeners.delete(notify);
        cleanup();
      }
    };
  });
  const getSnapshot = vi.fn(() => value);
  return {
    atom: createSourceAtom({ getSnapshot, subscribe }),
    subscribe,
    cleanup,
    getSnapshot,
    listeners,
    set(next: T) {
      value = next;
      for (const listener of listeners) {
        listener();
      }
    }
  };
}

it('samples lazily without subscribing and exposes a readonly atom', () => {
  const getSnapshot = vi.fn(() => 42);
  const subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
  const atom = createSourceAtom({ getSnapshot, subscribe });
  expect(getSnapshot).not.toHaveBeenCalled();
  expect(atom.get()).toBe(42);
  expect(subscribe).not.toHaveBeenCalled();
  expect('set' in atom).toBe(false);
  if (false) {
    // @ts-expect-error Source atoms cannot be written to.
    atom.set(10);
  }
});

it('refreshes unobserved source reads', () => {
  const source = externalSource(1);
  expect(source.atom.get()).toBe(1);
  source.set(2);
  expect(source.atom.get()).toBe(2);
  expect(source.subscribe).not.toHaveBeenCalled();
});

it('does not activate through unobserved derived reads', () => {
  const source = externalSource(1);
  const derived = createAtom(() => source.atom.get() * 2);
  expect(derived.get()).toBe(2);
  expect(source.subscribe).not.toHaveBeenCalled();
  const subscription = derived.subscribe(vi.fn());
  expect(source.subscribe).toHaveBeenCalledTimes(1);
  subscription.unsubscribe();
  expect(source.cleanup).toHaveBeenCalledTimes(1);
});

it('shares a listener across direct, transitive, and diamond consumers', () => {
  const source = externalSource(1);
  const left = createAtom(() => source.atom.get() + 1);
  const right = createAtom(() => source.atom.get() * 2);
  const combined = createAtom(() => left.get() + right.get());
  const observer = vi.fn();
  const indirect = combined.subscribe(observer);
  const direct = source.atom.subscribe(vi.fn());
  expect(source.subscribe).toHaveBeenCalledTimes(1);
  source.set(2);
  expect(observer.mock.calls).toEqual([[7]]);
  indirect.unsubscribe();
  expect(source.cleanup).not.toHaveBeenCalled();
  direct.unsubscribe();
  direct.unsubscribe();
  expect(source.cleanup).toHaveBeenCalledTimes(1);
});

it('drops conditional dependencies and reconnects when selected again', () => {
  const selected = createAtom(true);
  const source = externalSource(1);
  const derived = createAtom(() => (selected.get() ? source.atom.get() : 0));
  const observer = vi.fn();
  const subscription = derived.subscribe(observer);
  selected.set(false);
  expect(source.cleanup).toHaveBeenCalledTimes(1);
  source.set(2);
  selected.set(true);
  expect(source.subscribe).toHaveBeenCalledTimes(2);
  expect(observer.mock.calls).toEqual([[0], [2]]);
  subscription.unsubscribe();
  expect(source.cleanup).toHaveBeenCalledTimes(2);
});

it('retains a shared source while its observed path moves between branches', () => {
  const selected = createAtom(true);
  const source = externalSource(1);
  const left = createAtom(() => source.atom.get() + 1);
  const right = createAtom(() => source.atom.get() + 2);
  const derived = createAtom(() => (selected.get() ? left.get() : right.get()));
  const subscription = derived.subscribe(vi.fn());
  selected.set(false);
  expect(derived.get()).toBe(3);
  expect(source.subscribe).toHaveBeenCalledTimes(1);
  expect(source.cleanup).not.toHaveBeenCalled();
  subscription.unsubscribe();
  expect(source.cleanup).toHaveBeenCalledTimes(1);
});

it('refreshes on remount and ignores callbacks from prior subscriptions', () => {
  const source = externalSource(1);
  const derived = createAtom(() => source.atom.get() * 2);
  const first = derived.subscribe(vi.fn());
  const oldNotify = [...source.listeners][0];
  first.unsubscribe();
  source.set(2);
  const observer = vi.fn();
  const second = derived.subscribe(observer);
  expect(derived.get()).toBe(4);
  const reads = source.getSnapshot.mock.calls.length;
  oldNotify();
  expect(source.getSnapshot).toHaveBeenCalledTimes(reads);
  expect(observer).not.toHaveBeenCalled();
  source.set(3);
  expect(observer.mock.calls).toEqual([[6]]);
  second.unsubscribe();
});

it('reads after registration, including synchronous notifications', () => {
  let value = 0;
  const cleanup = vi.fn();
  const atom = createSourceAtom({
    getSnapshot: () => value,
    subscribe(notify) {
      value = 1;
      notify();
      value = 2;
      notify();
      return { unsubscribe: cleanup };
    }
  });
  const derived = createAtom(() => atom.get() * 2);
  const observer = vi.fn();
  const subscription = derived.subscribe(observer);
  expect(derived.get()).toBe(4);
  expect(observer.mock.calls).toEqual([[4]]);
  subscription.unsubscribe();
  expect(cleanup).toHaveBeenCalledTimes(1);
});

it('uses comparison to suppress unchanged snapshots', () => {
  let value = { count: 1 };
  let notify = () => {};
  const atom = createSourceAtom(
    {
      getSnapshot: () => value,
      subscribe(listener) {
        notify = listener;
        return { unsubscribe() {} };
      }
    },
    { compare: (previous, next) => previous.count === next.count }
  );
  const observer = vi.fn();
  const subscription = atom.subscribe(observer);
  value = { count: 1 };
  notify();
  expect(observer).not.toHaveBeenCalled();
  value = { count: 2 };
  notify();
  expect(observer.mock.calls).toEqual([[{ count: 2 }]]);
  subscription.unsubscribe();
});

it('works through store selections', () => {
  const source = externalSource(1);
  const store = createStore({ context: { count: 2 }, on: {} });
  const selected = store.select((context) => context.count + source.atom.get());
  const observer = vi.fn();
  const subscription = selected.subscribe(observer);
  expect(source.subscribe).toHaveBeenCalledTimes(1);
  source.set(3);
  expect(observer.mock.calls).toEqual([[5]]);
  subscription.unsubscribe();
  expect(source.cleanup).toHaveBeenCalledTimes(1);
});

it('does not track reads inside external snapshot or registration callbacks', () => {
  const unrelated = createAtom(1);
  const subscribe = vi.fn(() => {
    unrelated.get();
    return { unsubscribe() {} };
  });
  const getSnapshot = vi.fn(() => unrelated.get());
  const atom = createSourceAtom({ getSnapshot, subscribe });
  const observer = vi.fn();
  const subscription = atom.subscribe(observer);
  unrelated.set(2);
  expect(atom.get()).toBe(1);
  expect(observer).not.toHaveBeenCalled();
  subscription.unsubscribe();
});

it('rolls back failed activation and can retry', () => {
  const error = new Error('registration failed');
  let fail = true;
  const cleanup = vi.fn();
  const subscribe = vi.fn(() => {
    if (fail) {
      throw error;
    }
    return { unsubscribe: cleanup };
  });
  const atom = createSourceAtom({ getSnapshot: () => 1, subscribe });
  expect(() => atom.subscribe(vi.fn())).toThrow(error);
  fail = false;
  const subscription = atom.subscribe(vi.fn());
  expect(subscribe).toHaveBeenCalledTimes(2);
  subscription.unsubscribe();
  expect(cleanup).toHaveBeenCalledTimes(1);
});

it('cleans up if the post-registration snapshot throws', () => {
  let registered = false;
  const cleanup = vi.fn();
  const error = new Error('snapshot failed');
  const atom = createSourceAtom({
    getSnapshot() {
      if (registered) {
        throw error;
      }
      return 1;
    },
    subscribe() {
      registered = true;
      return { unsubscribe: cleanup };
    }
  });
  expect(() => atom.subscribe(vi.fn())).toThrow(error);
  expect(cleanup).toHaveBeenCalledTimes(1);
});

it('does not leak subscriptions when a derived getter throws', () => {
  const source = externalSource(1);
  const derived = createAtom(() => {
    source.atom.get();
    throw new Error('getter failed');
  });
  expect(() => derived.subscribe(vi.fn())).toThrow('getter failed');
  expect(source.subscribe).not.toHaveBeenCalled();
  const subscription = source.atom.subscribe(vi.fn());
  subscription.unsubscribe();
  expect(source.cleanup).toHaveBeenCalledTimes(1);
});

it('settles other resource cleanups even when one throws', () => {
  const error = new Error('cleanup failed');
  const first = createSourceAtom({
    getSnapshot: () => 1,
    subscribe: () => ({
      unsubscribe() {
        throw error;
      }
    })
  });
  const source = externalSource(2);
  const combined = createAtom(() => first.get() + source.atom.get());
  const subscription = combined.subscribe(vi.fn());
  expect(() => subscription.unsubscribe()).toThrow(error);
  expect(source.cleanup).toHaveBeenCalledTimes(1);
  subscription.unsubscribe();
  expect(source.cleanup).toHaveBeenCalledTimes(1);
});

it('invalidates late callbacks before cleanup runs, including undefined values', () => {
  let value: number | undefined = 1;
  let notify = () => {};
  const getSnapshot = vi.fn(() => value);
  const atom = createSourceAtom({
    getSnapshot,
    subscribe(listener) {
      notify = listener;
      return {
        unsubscribe() {
          value = 3;
          listener();
        }
      };
    }
  });
  const observer = vi.fn();
  const subscription = atom.subscribe(observer);
  value = undefined;
  notify();
  expect(observer.mock.calls).toEqual([[undefined]]);
  const reads = getSnapshot.mock.calls.length;
  subscription.unsubscribe();
  expect(getSnapshot).toHaveBeenCalledTimes(reads);
  notify();
  expect(getSnapshot).toHaveBeenCalledTimes(reads);
  expect(atom.get()).toBe(3);
});

it('handles function-valued snapshots without invoking them', () => {
  const first = vi.fn(() => 1);
  const second = vi.fn(() => 2);
  const source = externalSource(first);
  const observer = vi.fn();
  const subscription = source.atom.subscribe(observer);
  source.set(second);
  expect(source.atom.get()).toBe(second);
  expect(observer.mock.calls).toEqual([[second]]);
  expect(first).not.toHaveBeenCalled();
  expect(second).not.toHaveBeenCalled();
  subscription.unsubscribe();
});

it('reconciles dependencies changed by the post-registration snapshot', () => {
  let value = false;
  const first = createSourceAtom({
    getSnapshot: () => value,
    subscribe() {
      value = true;
      return { unsubscribe() {} };
    }
  });
  const source = externalSource(1);
  const derived = createAtom(() => (first.get() ? 0 : source.atom.get()));
  const subscription = derived.subscribe(vi.fn());
  expect(derived.get()).toBe(0);
  expect(source.subscribe).not.toHaveBeenCalled();
  subscription.unsubscribe();
});

it('can unsubscribe inside a notification and later reconnect', () => {
  const source = externalSource(1);
  const firstObserver = vi.fn(() => first.unsubscribe());
  const first = source.atom.subscribe(firstObserver);
  source.set(2);
  expect(source.cleanup).toHaveBeenCalledTimes(1);
  const secondObserver = vi.fn();
  const second = source.atom.subscribe(secondObserver);
  source.set(3);
  expect(firstObserver).toHaveBeenCalledTimes(1);
  expect(secondObserver.mock.calls).toEqual([[3]]);
  second.unsubscribe();
  expect(source.cleanup).toHaveBeenCalledTimes(2);
});

it('activates a source introduced into an existing subscription', async () => {
  vi.resetModules();
  const { createAtom, createSourceAtom } = await import('../src/index.ts');
  const selected = createAtom(false);
  let source: ReturnType<typeof createSourceAtom<number>>;
  const derived = createAtom(() => (selected.get() ? source.get() : 0));
  const observer = vi.fn();
  const subscription = derived.subscribe(observer);
  const cleanup = vi.fn();
  const subscribe = vi.fn(() => ({ unsubscribe: cleanup }));
  source = createSourceAtom({ getSnapshot: () => 42, subscribe });
  selected.set(true);
  expect(observer.mock.calls).toEqual([[42]]);
  expect(subscribe).toHaveBeenCalledTimes(1);
  subscription.unsubscribe();
  expect(cleanup).toHaveBeenCalledTimes(1);
});

it('preserves the subscription receiver when unsubscribing', () => {
  const unsubscribe = vi.fn(function (this: { closed: boolean }) {
    this.closed = true;
  });
  const external = { closed: false, unsubscribe };
  const source = createSourceAtom({
    getSnapshot: () => 1,
    subscribe: () => external
  });
  const consumer = source.subscribe(vi.fn());
  consumer.unsubscribe();
  consumer.unsubscribe();
  expect(external.closed).toBe(true);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it('normalizes either adapter result to an object-only public subscription', () => {
  let mounts = 0;
  const cleanup = vi.fn();
  const source = createSourceAtom({
    getSnapshot: () => 1,
    subscribe() {
      return ++mounts === 1 ? cleanup : { unsubscribe: cleanup };
    }
  });
  const derived = createAtom(() => source.get() * 2);
  for (let i = 0; i < 2; i++) {
    const consumer = derived.subscribe(vi.fn());
    expect(typeof consumer).toBe('object');
    expect(typeof consumer.unsubscribe).toBe('function');
    consumer.unsubscribe();
    consumer.unsubscribe();
    expect(cleanup).toHaveBeenCalledTimes(i + 1);
  }
});

it('runs function cleanup when post-registration snapshot reading fails', () => {
  let registered = false;
  const cleanup = vi.fn();
  const source = createSourceAtom({
    getSnapshot() {
      if (registered) {
        throw new Error('snapshot failed');
      }
      return 1;
    },
    subscribe() {
      registered = true;
      return cleanup;
    }
  });
  expect(() => source.subscribe(vi.fn())).toThrow('snapshot failed');
  expect(cleanup).toHaveBeenCalledTimes(1);
});

it.each(['registration', 'refresh'] as const)(
  'retries failed %s on a later operation while a derived consumer stays live',
  (failure) => {
    const enabled = createAtom(false);
    const tick = createAtom(0);
    const error = new Error('activation failed');
    let fail = true;
    let registered = false;
    let value = 1;
    let notify = () => {};
    const cleanup = vi.fn(() => {
      registered = false;
    });
    const subscribe = vi.fn((listener: () => void) => {
      if (failure === 'registration' && fail) {
        throw error;
      }
      registered = true;
      notify = listener;
      return cleanup;
    });
    const source = createSourceAtom({
      getSnapshot() {
        if (failure === 'refresh' && fail && registered) {
          throw error;
        }
        return value;
      },
      subscribe
    });
    const derived = createAtom(() => {
      tick.get();
      return enabled.get() ? source.get() : 0;
    });
    const observer = vi.fn();
    const consumer = derived.subscribe(observer);
    try {
      expect(() => enabled.set(true)).toThrow(error);
      expect(subscribe).toHaveBeenCalledTimes(1);
      fail = false;
      tick.set(1);
      expect(subscribe).toHaveBeenCalledTimes(2);
      value = 2;
      notify();
      expect(observer).toHaveBeenLastCalledWith(2);
    } finally {
      fail = false;
      consumer.unsubscribe();
    }
  }
);

it('reports source activation errors after async fulfillment instead of rejecting the notification promise', async () => {
  let resolve!: (value: number) => void;
  const promise = new Promise<number>((done) => {
    resolve = done;
  });
  const rejections: unknown[] = [];
  // Capture a discarded rejection deterministically without leaking it to the
  // test runner's process-wide unhandled-rejection handler.
  vi.spyOn(promise, 'then').mockImplementation((...args) => {
    const result = Promise.prototype.then.apply(promise, args);
    let handled = false;
    const catchError = result.catch.bind(result);
    void catchError((error) => {
      if (!handled) {
        rejections.push(error);
      }
    });
    vi.spyOn(result, 'catch').mockImplementation((handler) => {
      handled = true;
      return catchError(handler);
    });
    return result;
  });
  const asyncAtom = createAsyncAtom(() => promise);
  const error = new Error('source activation failed');
  const source = createSourceAtom({
    getSnapshot: () => 1,
    subscribe() {
      throw error;
    }
  });
  const derived = createAtom(() => {
    const state = asyncAtom.get();
    return state.status === 'done' ? source.get() : 0;
  });
  const consumer = derived.subscribe(vi.fn());
  try {
    resolve(42);
    await new Promise((done) => setTimeout(done, 0));
    expect(asyncAtom.get()).toEqual({ status: 'error', error });
    expect(rejections).toEqual([]);
  } finally {
    consumer.unsubscribe();
  }
});

it.each(['observer', 'comparison'] as const)(
  'retains async errors when %s also fails during error delivery',
  async (failure) => {
    const error = new Error('delivery failed');
    const atom = createAsyncAtom(() => Promise.resolve(42), {
      compare: (previous, next) => {
        if (failure === 'comparison' && next.status !== 'pending') {
          throw error;
        }
        return Object.is(previous, next);
      }
    });
    const consumer = atom.subscribe((state) => {
      if (failure === 'observer' && state.status !== 'pending') {
        throw error;
      }
    });
    try {
      await new Promise((done) => setTimeout(done, 0));
      expect(atom.get()).toEqual({ status: 'error', error });
    } finally {
      consumer.unsubscribe();
    }
  }
);
