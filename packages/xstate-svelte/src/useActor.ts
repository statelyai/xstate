import { Readable, readable } from 'svelte/store';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  EventFromLogic,
  SnapshotFrom,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys
} from 'xstate';
import { useActorRef } from './useActorRef.ts';

export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [
      options?: ActorOptions<TLogic> & {
        [K in RequiredActorOptionsKeys<TLogic>]: unknown;
      }
    ],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): {
  snapshot: Readable<SnapshotFrom<TLogic>>;
  send: (event: EventFromLogic<TLogic>) => void;
  actorRef: Actor<TLogic>;
} {
  const actorRef = useActorRef(logic, options);

  let currentSnapshot = actorRef.getSnapshot();

  const snapshot = readable(currentSnapshot, (set) => {
    // The actor might have transitioned while nothing was subscribed to this
    // store, so make sure it's up to date when a subscription (re)starts.
    const latestSnapshot = actorRef.getSnapshot();
    if (currentSnapshot !== latestSnapshot) {
      currentSnapshot = latestSnapshot;
      set(currentSnapshot);
    }
    return actorRef.subscribe((nextSnapshot) => {
      if (currentSnapshot !== nextSnapshot) {
        currentSnapshot = nextSnapshot;
        set(currentSnapshot);
      }
    }).unsubscribe;
  });

  return { snapshot, send: actorRef.send, actorRef };
}
