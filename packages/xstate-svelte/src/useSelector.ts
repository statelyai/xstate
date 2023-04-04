import { readable } from 'svelte/store';
import type { ActorRef, SnapshotFrom, Subscription } from 'xstate';

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

export const useSelector = <TActor extends ActorRef<any, any>, T>(
  actor: TActor,
  selector: (snapshot: SnapshotFrom<TActor>) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
) => {
  let sub: Subscription;

  let prevSelected = selector(actor.getSnapshot());

  const selected = readable(prevSelected, (set) => {
    sub = actor.subscribe((state) => {
      const nextSelected = selector(state);
      if (!compare(prevSelected, nextSelected)) {
        prevSelected = nextSelected;
        set(nextSelected);
      }
    });

    return () => {
      sub.unsubscribe();
    };
  });

  return selected;
};
