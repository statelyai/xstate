import { readable } from 'svelte/store';
import type { ActorRef, AnyActorRef, SnapshotFrom, Subscription } from 'xstate';

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

export const useSelector = <
  TActor extends Pick<AnyActorRef, 'getSnapshot' | 'subscribe'>,
  T
>(
  actor: TActor,
  selector: (
    snapshot: TActor extends { getSnapshot(): infer TSnapshot }
      ? TSnapshot
      : undefined
  ) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
) => {
  let sub: Subscription;

  let prevSelected = selector(actor.getSnapshot());

  const selected = readable(prevSelected, (set) => {
    const onNext = (snapshot: SnapshotFrom<TActor>) => {
      const nextSelected = selector(snapshot);
      if (!compare(prevSelected, nextSelected)) {
        prevSelected = nextSelected;
        set(nextSelected);
      }
    };

    // Make sure the store gets updated when it's subscribed to.
    onNext(actor.getSnapshot());

    sub = actor.subscribe(onNext);

    return () => {
      sub.unsubscribe();
    };
  });

  return selected;
};
