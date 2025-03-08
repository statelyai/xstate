import { createAtom } from '../src/atom';
import { createStore } from '../src/store';

it('create atom', () => {
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
