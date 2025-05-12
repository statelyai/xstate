import { createStore, createAtom } from '../src/';
import { createAsyncAtom } from '../src/atom';

it('creates an atom', () => {
  const atom = createAtom(42);

  expect(atom.get()).toBe(42);
});

it('sets the value of the atom using a function', () => {
  const atom = createAtom(0);

  atom.set((prev) => prev + 1);

  expect(atom.get()).toBe(1);

  atom.set((prev) => prev + 1);

  expect(atom.get()).toBe(2);
});

it('can subscribe to atom changes', () => {
  const log = jest.fn();
  const atom = createAtom(0);

  atom.subscribe(log);

  atom.set(1);

  expect(log).toHaveBeenCalledWith(1);

  atom.set(2);

  expect(log).toHaveBeenCalledWith(2);
});

it('can unsubscribe from atom changes', () => {
  const log = jest.fn();
  const atom = createAtom(0);

  const sub = atom.subscribe(log);

  atom.set(1);

  expect(log).toHaveBeenCalledWith(1);

  sub.unsubscribe();

  atom.set(2);

  expect(log).toHaveBeenCalledTimes(1);
});

it('can create a combined atom', () => {
  const nameAtom = createAtom('a');
  const numAtom = createAtom(3);
  const combinedAtom = createAtom((read) =>
    read(nameAtom).repeat(read(numAtom))
  );

  expect(combinedAtom.get()).toBe('aaa');

  nameAtom.set('b');

  expect(combinedAtom.get()).toBe('bbb');

  numAtom.set(5);
});

it('can create a combined atom (get API)', () => {
  const nameAtom = createAtom('a');
  const numAtom = createAtom(3);
  const combinedAtom = createAtom(() => nameAtom.get().repeat(numAtom.get()));

  expect(combinedAtom.get()).toBe('aaa');

  nameAtom.set('b');

  expect(combinedAtom.get()).toBe('bbb');

  numAtom.set(5);
});

it('works with a mix of atoms and stores', () => {
  const countAtom = createAtom(0);
  const store = createStore({
    context: { name: 'David' },
    on: {
      nameUpdated: (context, event: { name: string }) => ({
        ...context,
        name: event.name
      })
    }
  });

  const combinedAtom = createAtom(
    (read) => read(store).context.name + ` ${read(countAtom)}`
  );

  expect(combinedAtom.get()).toBe('David 0');

  store.send({ type: 'nameUpdated', name: 'John' });

  expect(combinedAtom.get()).toBe('John 0');

  countAtom.set(1);

  expect(combinedAtom.get()).toBe('John 1');
});

it('works with a mix of atoms and stores (get API)', () => {
  const countAtom = createAtom(0);
  const store = createStore({
    context: { name: 'David' },
    on: {
      nameUpdated: (context, event: { name: string }) => ({
        ...context,
        name: event.name
      })
    }
  });

  const log = jest.fn();

  const combinedAtom = createAtom(
    () => store.get().context.name + ` ${countAtom.get()}`
  );

  combinedAtom.subscribe(log);

  expect(combinedAtom.get()).toBe('David 0');

  store.send({ type: 'nameUpdated', name: 'John' });

  expect(combinedAtom.get()).toBe('John 0');

  countAtom.set(1);

  expect(log).toHaveBeenCalledTimes(2);
  expect(log).toHaveBeenCalledWith('John 1');
  expect(countAtom.get()).toBe(1);
  expect(combinedAtom.get()).toBe('John 1');
});

it('works with stores', () => {
  const nameStore = createStore({
    context: { name: 'David' },
    on: {
      nameUpdated: (context, event: { name: string }) => ({
        ...context,
        name: event.name
      })
    }
  });

  const countStore = createStore({
    context: { count: 0 },
    on: {
      increment: (context) => ({ ...context, count: context.count + 1 })
    }
  });

  const combinedAtom = createAtom(
    (read) =>
      read(nameStore).context.name + ` ${read(countStore).context.count}`
  );

  expect(combinedAtom.get()).toBe('David 0');

  nameStore.trigger.nameUpdated({ name: 'John' });

  expect(combinedAtom.get()).toBe('John 0');

  countStore.trigger.increment();

  expect(combinedAtom.get()).toBe('John 1');
});

it('works with stores (get API)', () => {
  const nameStore = createStore({
    context: { name: 'David' },
    on: {
      nameUpdated: (context, event: { name: string }) => ({
        ...context,
        name: event.name
      })
    }
  });

  const countStore = createStore({
    context: { count: 0 },
    on: {
      increment: (context) => ({ ...context, count: context.count + 1 })
    }
  });

  const combinedAtom = createAtom(
    () => nameStore.get().context.name + ` ${countStore.get().context.count}`
  );

  expect(combinedAtom.get()).toBe('David 0');

  nameStore.trigger.nameUpdated({ name: 'John' });

  expect(combinedAtom.get()).toBe('John 0');

  countStore.trigger.increment();

  expect(combinedAtom.get()).toBe('John 1');
});

it('works with selectors', () => {
  const store = createStore({
    context: { name: 'David', count: 0 },
    on: {
      increment: (context) => ({ ...context, count: context.count + 1 })
    }
  });

  const count = store.select((ctx) => ctx.count);

  const combinedAtom = createAtom((read) => 2 * read(count));

  expect(combinedAtom.get()).toBe(0);

  store.trigger.increment();

  expect(combinedAtom.get()).toBe(2);
});

it('works with selectors (get API)', () => {
  const store = createStore({
    context: { name: 'David', count: 0 },
    on: {
      increment: (context) => ({ ...context, count: context.count + 1 })
    }
  });

  const count = store.select((ctx) => ctx.count);

  const combinedAtom = createAtom(() => 2 * count.get());

  expect(combinedAtom.get()).toBe(0);

  store.trigger.increment();

  expect(combinedAtom.get()).toBe(2);
});

it('combined atoms should be read-only', () => {
  const atom1 = createAtom(0);
  const atom2 = createAtom(1);
  const combinedAtom = createAtom((read) => read(atom1) + read(atom2));

  expect(combinedAtom.get()).toBe(1);

  // @ts-expect-error
  combinedAtom.set?.(2);

  expect(combinedAtom.get()).toBe(1);
});

it('combined atoms should be read-only (get API)', () => {
  const atom1 = createAtom(0);
  const atom2 = createAtom(1);
  const combinedAtom = createAtom(() => atom1.get() + atom2.get());

  expect(combinedAtom.get()).toBe(1);

  // @ts-expect-error
  combinedAtom.set?.(2);

  expect(combinedAtom.get()).toBe(1);
});

it('conditionally read atoms are properly read in combined atoms', () => {
  const atom1 = createAtom(true);
  const atom2 = createAtom(false);
  const activatorAtom = createAtom<'inactive' | 'active'>('inactive');
  const combinedAtom = createAtom((read) =>
    read(activatorAtom) === 'active' ? read(atom1) : read(atom2)
  );

  expect(combinedAtom.get()).toBe(false);

  activatorAtom.set('active');

  expect(combinedAtom.get()).toBe(true);

  activatorAtom.set('inactive');

  expect(combinedAtom.get()).toBe(false);
});

it('conditionally read atoms are properly read in combined atoms (get API)', () => {
  const atom1 = createAtom(true);
  const atom2 = createAtom(false);
  const activatorAtom = createAtom<'inactive' | 'active'>('inactive');
  const combinedAtom = createAtom(() =>
    activatorAtom.get() === 'active' ? atom1.get() : atom2.get()
  );

  expect(combinedAtom.get()).toBe(false);

  activatorAtom.set('active');

  expect(combinedAtom.get()).toBe(true);

  activatorAtom.set('inactive');

  expect(combinedAtom.get()).toBe(false);
});

it('conditionally read atoms are properly unsubscribed when no longer needed', () => {
  const atom1 = createAtom(true);
  const activatorAtom = createAtom<'inactive' | 'active'>('active');
  const combinedAtom = createAtom((read) =>
    read(activatorAtom) === 'active' ? read(atom1) : {}
  );

  const vals: any[] = [];

  combinedAtom.subscribe((val) => vals.push(val));

  atom1.set(false);

  expect(vals).toEqual([false]);

  atom1.set(true);

  expect(vals).toEqual([false, true]);

  activatorAtom.set('inactive');

  // From here, atom1 should no longer be subscribed to
  // Without the unsubscribe logic, this would be [false, true, {}, {}, ...]

  expect(vals).toEqual([false, true, {}]);

  atom1.set(false);

  expect(vals).toEqual([false, true, {}]);

  atom1.set(true);

  expect(vals).toEqual([false, true, {}]);

  // Subscribing again should cause atom1 to be subscribed again

  activatorAtom.set('active');

  expect(vals).toEqual([false, true, {}, true]);

  atom1.set(false);

  expect(vals).toEqual([false, true, {}, true, false]);
});

it('conditionally read atoms are properly unsubscribed when no longer needed (get API)', () => {
  const atom1 = createAtom(true);
  const activatorAtom = createAtom<'inactive' | 'active'>('active');
  const combinedAtom = createAtom(() =>
    activatorAtom.get() === 'active' ? atom1.get() : {}
  );

  const vals: any[] = [];

  combinedAtom.subscribe((val) => {
    vals.push(val);
  });

  expect(vals).toEqual([]);

  atom1.set(false);

  expect(vals).toEqual([false]);

  atom1.set(true);

  expect(vals).toEqual([false, true]);

  activatorAtom.set('inactive');

  // From here, atom1 should no longer be subscribed to
  // Without the unsubscribe logic, this would be [false, true, {}, {}, ...]

  expect(vals).toEqual([false, true, {}]);

  atom1.set(false);

  expect(vals).toEqual([false, true, {}]);

  atom1.set(true);

  expect(vals).toEqual([false, true, {}]);

  // Subscribing again should cause atom1 to be subscribed again

  activatorAtom.set('active');

  expect(vals).toEqual([false, true, {}, true]);

  atom1.set(false);

  expect(vals).toEqual([false, true, {}, true, false]);
});

it('handles diamond dependencies with single update', () => {
  const log = jest.fn();
  const sourceAtom = createAtom(1);

  const pathA = createAtom(() => sourceAtom.get() * 2);
  const pathB = createAtom(() => sourceAtom.get() * 3);

  const bottomAtom = createAtom(() => pathA.get() + pathB.get());

  bottomAtom.subscribe((x) => {
    log(x);
  });

  // Initial value: (1 * 2) + (1 * 3) = 5
  expect(bottomAtom.get()).toBe(5);
  expect(log).toHaveBeenCalledTimes(0);

  // Update source: (2 * 2) + (2 * 3) = 10
  sourceAtom.set(2);

  const result = bottomAtom.get();

  expect(result).toBe(10);

  // Without proper diamond problem handling, log might be called multiple times
  // as the update propagates through both paths
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenCalledWith(10);
});

it('handles complex diamond dependencies correctly', () => {
  const log = jest.fn();

  // Base atom D
  const atomD = createAtom(1);

  // Level 1 - C depends on D
  const atomC = createAtom(() => atomD.get() * 2);

  // Level 2 - B depends on C and D
  const atomB = createAtom(() => atomC.get() + atomD.get());

  // Level 3 - A depends on B, C, and D
  const atomA = createAtom(() => atomB.get() + atomC.get() + atomD.get());

  atomA.subscribe(log);

  // Initial computation:
  // D = 1
  // C = D * 2 = 2
  // B = C + D = 3
  // A = B + C + D = 6
  expect(atomA.get()).toBe(6);
  expect(log).toHaveBeenCalledTimes(0);

  // Update base atom D
  atomD.set(2);

  // After update:
  // D = 2
  // C = D * 2 = 4
  // B = C + D = 6
  // A = B + C + D = 12
  expect(atomA.get()).toBe(12);

  // Should only trigger one update despite multiple dependency paths
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenCalledWith(12);

  // Verify intermediate values
  expect(atomB.get()).toBe(6);
  expect(atomC.get()).toBe(4);
  expect(atomD.get()).toBe(2);
});

it('supports custom equality functions through compare option', () => {
  const log = jest.fn();

  const coordAtom = createAtom(
    { x: 0, y: 0 },
    {
      compare: (prev, next) => prev.x === next.x && prev.y === next.y
    }
  );

  coordAtom.subscribe(log);

  // Initial value
  expect(coordAtom.get()).toEqual({ x: 0, y: 0 });
  expect(log).not.toHaveBeenCalled();

  // Setting same values shouldn't trigger update
  coordAtom.set({ x: 0, y: 0 });
  expect(log).not.toHaveBeenCalled();

  // Different x value should trigger update
  coordAtom.set({ x: 1, y: 0 });
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenCalledWith({ x: 1, y: 0 });

  // Different y value should trigger update
  coordAtom.set({ x: 1, y: 2 });
  expect(log).toHaveBeenCalledTimes(2);
  expect(log).toHaveBeenLastCalledWith({ x: 1, y: 2 });

  // Setting same values should not trigger update
  coordAtom.set({ x: 1, y: 2 });
  expect(log).toHaveBeenCalledTimes(2);
});

it('uses Object.is as default equality function', () => {
  const log = jest.fn();
  const objAtom = createAtom({ value: 0 });

  objAtom.subscribe(log);

  // Initial value
  expect(objAtom.get()).toEqual({ value: 0 });
  expect(log).not.toHaveBeenCalled();

  // Setting with same shape but new object should trigger update
  objAtom.set({ value: 0 });
  expect(log).toHaveBeenCalledTimes(1);

  // Setting with same object reference shouldn't trigger update
  const obj = { value: 1 };
  objAtom.set(obj);
  expect(log).toHaveBeenCalledTimes(2);
  objAtom.set(obj);
  expect(log).toHaveBeenCalledTimes(2);
});

it('Atom-specific properties should not be exposed', () => {
  const atom = createAtom(0);

  // @ts-expect-error
  atom._subs;
  // @ts-expect-error
  atom._subsTail;
  // @ts-expect-error
  atom._snapshot;
  // @ts-expect-error
  atom._flags;
  // @ts-expect-error
  atom._deps;
  // @ts-expect-error
  atom._depsTail;

  const computed = createAtom(() => atom.get());

  // @ts-expect-error
  computed._subs;
  // @ts-expect-error
  computed._subsTail;
  // @ts-expect-error
  computed._snapshot;
  // @ts-expect-error
  computed._flags;
  // @ts-expect-error
  computed._deps;
  // @ts-expect-error
  computed._depsTail;

  const store = createStore({
    context: {},
    on: {}
  });

  // @ts-expect-error
  store._subs;
  // @ts-expect-error
  store._subsTail;
  // @ts-expect-error
  store._snapshot;
  // @ts-expect-error
  store._flags;
  // @ts-expect-error
  store._deps;
  // @ts-expect-error
  store._depsTail;
});

describe('async atoms', () => {
  it('async atoms should work (fulfilled)', async () => {
    const atom = createAsyncAtom(async () => 'hello');

    expect(atom.get()).toEqual({ status: 'pending' });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(atom.get()).toEqual({ status: 'done', data: 'hello' });
  });

  it('async atoms should work (rejected)', async () => {
    const atom = createAsyncAtom(async () => {
      throw new Error('test');
    });

    expect(atom.get()).toEqual({ status: 'pending' });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(atom.get()).toEqual({
      status: 'error',
      error: expect.any(Error)
    });
  });

  it('should only call getValue once for multiple concurrent reads', async () => {
    let getValueCallCount = 0;
    const RESOLVED_VALUE = 'test-value';

    const myAsyncAtom = createAsyncAtom(async () => {
      getValueCallCount++;
      return RESOLVED_VALUE;
    });

    // Initial reads should show pending status
    expect(myAsyncAtom.get()).toEqual({ status: 'pending' });
    expect(myAsyncAtom.get()).toEqual({ status: 'pending' });

    // Let the promise resolve
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Both reads should now show the resolved value
    expect(myAsyncAtom.get()).toEqual({
      status: 'done',
      data: RESOLVED_VALUE
    });
    expect(myAsyncAtom.get()).toEqual({
      status: 'done',
      data: RESOLVED_VALUE
    });

    // getValue should have only been called once
    expect(getValueCallCount).toBe(1);

    // Additional reads after resolution should still use cached value
    expect(myAsyncAtom.get()).toEqual({
      status: 'done',
      data: RESOLVED_VALUE
    });
    expect(getValueCallCount).toBe(1);
  });

  it('should only call getValue once even when error occurs', async () => {
    let getValueCallCount = 0;
    const ERROR_MESSAGE = 'test error';

    const myAsyncAtom = createAsyncAtom(async () => {
      getValueCallCount++;
      throw new Error(ERROR_MESSAGE);
    });

    // Initial reads should show pending status
    expect(myAsyncAtom.get()).toEqual({ status: 'pending' });
    expect(myAsyncAtom.get()).toEqual({ status: 'pending' });

    // Let the promise reject
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Both reads should now show the error
    expect(myAsyncAtom.get()).toEqual({
      status: 'error',
      error: expect.any(Error)
    });
    expect(myAsyncAtom.get()).toEqual({
      status: 'error',
      error: expect.any(Error)
    });

    // getValue should have only been called once
    expect(getValueCallCount).toBe(1);

    // Additional reads after rejection should still use cached error
    expect(myAsyncAtom.get()).toEqual({
      status: 'error',
      error: expect.any(Error)
    });
    expect(getValueCallCount).toBe(1);
  });

  it('async atoms should not have a .set() method', () => {
    const atom = createAsyncAtom(async () => 'hello');

    expect(
      // @ts-expect-error
      atom.set
    ).toBeUndefined();
  });
});
