import { ActorRef, SnapshotFrom } from 'xstate';
import { computed, Signal, signal } from '@angular/core';

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

export function useSelector<TActor extends ActorRef<any, any> | undefined, T>(
  actor: TActor,
  selector: (
    snapshot: TActor extends ActorRef<any, any>
      ? SnapshotFrom<TActor>
      : undefined
  ) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
): Signal<T> {
  const actorRefRef = signal(actor);
  return computed(
    () => {
      const actorRef = actorRefRef();
      const snapshot = actorRef?.getSnapshot();
      return selector(snapshot);
    },
    { equal: compare }
  );
}
