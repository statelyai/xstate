import { Readable, readable } from 'svelte/store';
import {
  ActorOptions,
  AnyActorLogic,
  ActorRefFrom,
  EventFrom,
  SnapshotFrom,
  AnyActorRef
} from 'xstate';
import { useActorRef } from './useActorRef';

export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: ActorOptions<TLogic>
): {
  snapshot: Readable<SnapshotFrom<TLogic>>;
  send: (event: EventFrom<TLogic>) => void;
  actorRef: ActorRefFrom<TLogic>;
} {
  const actorRef = useActorRef(logic, options) as AnyActorRef;

  let currentSnapshot = actorRef.getSnapshot();

  const snapshot = readable(currentSnapshot, (set) => {
    return actorRef.subscribe((nextSnapshot) => {
      if (currentSnapshot !== nextSnapshot) {
        currentSnapshot = nextSnapshot;
        set(currentSnapshot);
      }
    }).unsubscribe;
  });

  return { snapshot, send: actorRef.send, actorRef } as any;
}
