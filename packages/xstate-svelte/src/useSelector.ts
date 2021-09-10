import { get, readable } from 'svelte/store';
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
