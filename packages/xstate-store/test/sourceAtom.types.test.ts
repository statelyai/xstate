import { expectTypeOf } from 'vitest';
import {
  createAtom,
  createSourceAtom,
  type Subscription
} from '../src/index.ts';

it('infers snapshot, observer, comparator, and derived value types', () => {
  const source = createSourceAtom(
    {
      getSnapshot: () => ({ count: 1 }),
      subscribe(notify) {
        expectTypeOf(notify).toEqualTypeOf<() => void>();
        return { unsubscribe() {} };
      }
    },
    {
      compare(previous, next) {
        expectTypeOf(previous).toEqualTypeOf<{ count: number }>();
        expectTypeOf(next).toEqualTypeOf<{ count: number }>();
        return previous.count === next.count;
      }
    }
  );
  expectTypeOf(source.get()).toEqualTypeOf<{ count: number }>();
  const subscription = source.subscribe((snapshot) => {
    expectTypeOf(snapshot).toEqualTypeOf<{ count: number }>();
  });
  expectTypeOf(subscription).toEqualTypeOf<Subscription>();
  subscription.unsubscribe();
  const derived = createAtom(() => source.get().count);
  expectTypeOf(derived.get()).toEqualTypeOf<number>();
});

it('accepts an existing atom subscription without a cleanup adapter', () => {
  const original = createAtom(42);
  const source = createSourceAtom({
    getSnapshot: original.get,
    subscribe: original.subscribe
  });
  expectTypeOf(source.get()).toEqualTypeOf<number>();
  const subscription = source.subscribe(() => {});
  subscription.unsubscribe();
});

it('rejects writes, incompatible consumers, and invalid subscriptions', () => {
  const source = createSourceAtom({
    getSnapshot: () => 42,
    subscribe(notify) {
      if (false) {
        // @ts-expect-error Notification is a signal, not a snapshot payload.
        notify(42);
      }
      return { unsubscribe() {} };
    }
  });
  if (false) {
    // @ts-expect-error Source atoms are readonly.
    source.set(1);
    // @ts-expect-error Observers must accept the inferred snapshot type.
    source.subscribe((value: string) => {});
    createSourceAtom({
      getSnapshot: () => 1,
      // @ts-expect-error Registration must return a Subscription object.
      subscribe: () => () => {}
    });
    createSourceAtom({
      getSnapshot: () => 1,
      // @ts-expect-error Registration cannot omit its subscription.
      subscribe: () => {}
    });
  }
});
