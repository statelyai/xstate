import { createStore, createAtom } from '../src/';

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

it('combined atoms should be read-only', () => {
  const atom1 = createAtom(0);
  const atom2 = createAtom(1);
  const combinedAtom = createAtom((read) => read(atom1) + read(atom2));

  expect(combinedAtom.get()).toBe(1);

  // @ts-expect-error
  combinedAtom.set?.(2);

  expect(combinedAtom.get()).toBe(1);
});
