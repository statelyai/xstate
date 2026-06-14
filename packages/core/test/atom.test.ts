import {
  createActor,
  createAtom,
  createMachine,
  createReducerAtom,
  createTransitionLogic,
  isAtom
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

it('isAtom detects atoms but not plain objects/actors', () => {
  expect(isAtom(createAtom(0))).toBe(true);
  expect(isAtom(createAtom(() => 1))).toBe(true);
  expect(isAtom(createReducerAtom(0, (s: number) => s))).toBe(true);
  expect(isAtom({ get: () => 1, subscribe: () => ({}) })).toBe(false);
  expect(isAtom(null)).toBe(false);
  expect(isAtom(42)).toBe(false);
});

// Builds a machine that records the latest `CHANGED.value` into context. `entry`
// wires up the subscription under test; `extraOn` adds any extra handlers.
const subscribeMachine = (entry: any, extraOn: any = {}) =>
  createMachine({
    context: { value: 0 },
    initial: 'listening',
    states: {
      listening: {
        entry,
        on: {
          CHANGED: ({ event }: any) => ({
            context: { value: event.value }
          }),
          ...extraOn
        }
      }
    }
  });

it('enq.subscribeTo accepts an atom; mapper receives the atom value', () => {
  const source = createAtom(0);

  const actor = createActor(
    subscribeMachine((_: any, enq: any) => {
      enq.subscribeTo(source, (value: number) => ({ type: 'CHANGED', value }));
    })
  ).start();

  expect(actor.getSnapshot().context.value).toBe(0);

  source.set(10);
  expect(actor.getSnapshot().context.value).toBe(10);

  source.set((v) => v + 5);
  expect(actor.getSnapshot().context.value).toBe(15);
});

it('enq.subscribeTo accepts a reducer atom', () => {
  const source = createReducerAtom(
    0,
    (count: number, ev: { by: number }) => count + ev.by
  );

  const actor = createActor(
    subscribeMachine((_: any, enq: any) => {
      enq.subscribeTo(source, (value: number) => ({ type: 'CHANGED', value }));
    })
  ).start();

  source.send({ by: 4 });
  expect(actor.getSnapshot().context.value).toBe(4);

  source.send({ by: 6 });
  expect(actor.getSnapshot().context.value).toBe(10);
});

it('enq.stop tears down an atom subscription and preserves context', () => {
  const source = createAtom(0);
  let subRef: any;

  const actor = createActor(
    subscribeMachine(
      (_: any, enq: any) => {
        subRef = enq.subscribeTo(source, (value: number) => ({
          type: 'CHANGED',
          value
        }));
      },
      {
        UNSUBSCRIBE: (_: any, enq: any) => {
          enq.stop(subRef);
        }
      }
    )
  ).start();

  source.set(3);
  expect(actor.getSnapshot().context.value).toBe(3);

  actor.send({ type: 'UNSUBSCRIBE' });
  // context must survive the stop (regression: special actions returning only
  // `{ children }` previously wiped context to undefined)
  expect(actor.getSnapshot().context.value).toBe(3);

  source.set(99); // subscription torn down — mapper no longer fires
  expect(actor.getSnapshot().context.value).toBe(3);
});

it('atom subscription is torn down when the parent actor stops', () => {
  const source = createAtom(0);
  let relayed = 0;

  const actor = createActor(
    subscribeMachine((_: any, enq: any) => {
      enq.subscribeTo(source, (value: number) => {
        relayed++;
        return { type: 'CHANGED', value };
      });
    })
  ).start();

  source.set(1);
  const relayedBeforeStop = relayed;

  actor.stop();
  source.set(2); // must not relay to the stopped parent
  expect(relayed).toBe(relayedBeforeStop);
});
