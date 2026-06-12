import {
  createActor,
  createAtom,
  createTransitionLogic
} from '../src/index.ts';

it('creates an atom', () => {
  const atom = createAtom(42);

  expect(atom.get()).toBe(42);

  atom.set(100);

  expect(atom.get()).toBe(100);
});

it('creates computed atoms from actor snapshots', () => {
  const actor = createActor(
    createTransitionLogic(
      (context: { count: number }, event: { type: 'inc' }) => {
        return {
          count: context.count + 1
        };
      },
      { count: 0 }
    )
  ).start();
  const count = createAtom(() => actor.get().context.count);
  const listener = vi.fn();

  count.subscribe(listener);
  actor.send({ type: 'inc' });

  expect(actor.get()).toBe(actor.getSnapshot());
  expect(count.get()).toBe(1);
  expect(listener).toHaveBeenCalledWith(1);
});

it('selects actor snapshots through computed atoms', () => {
  const actor = createActor(
    createTransitionLogic(
      (context: { count: number }, event: { type: 'inc' | 'noop' }) => {
        if (event.type === 'noop') {
          return context;
        }
        return {
          count: context.count + 1
        };
      },
      { count: 0 }
    )
  ).start();
  const count = actor.select((snapshot) => snapshot.context.count);
  const listener = vi.fn();

  count.subscribe(listener);
  actor.send({ type: 'noop' });
  actor.send({ type: 'inc' });

  expect(count.get()).toBe(1);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith(1);
});
