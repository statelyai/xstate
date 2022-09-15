import { readable } from 'svelte/store';
import type { ActorRef, Subscribable, Subscription } from 'xstate';

const defaultCompare = (a, b) => a === b;

export const useSelector = <
  TActor extends ActorRef<any, any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never
>(
  actor: TActor,
  selector: (emitted: TEmitted) => T,
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
