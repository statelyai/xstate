import { get, readable } from 'svelte/store';
import type { ActorRef, SnapshotFrom, Subscription } from 'xstate';

const defaultCompare = (a, b) => a === b;

export const useSelector = <TActor extends ActorRef<any, any>, T>(
  actor: TActor,
  selector: (snapshot: SnapshotFrom<TActor>) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
) => {
  let sub: Subscription;
  const selected = readable(selector(actor.getSnapshot()), (set) => {
    sub = actor.subscribe((state) => {
      const nextSelected = selector(state);
      if (!compare(get(selected), nextSelected)) {
        set(nextSelected);
      }
    });

    return () => {
      sub.unsubscribe();
    };
  });

  return selected;
};
