import isDevelopment from '#is-development';
import { Ref } from 'vue';
import {
  ActorOptions,
  ActorRefFrom,
  AnyActorLogic,
  EventFrom,
  Snapshot,
  SnapshotFrom
} from 'xstate';
import { useActorRef } from './useActorRef.ts';
import { useSelector } from './useSelector.ts';

export function useActor<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  options: ActorOptions<TLogic>
): {
  snapshot: Ref<SnapshotFrom<TLogic>>;
  send: (event: EventFrom<TLogic>) => void;
  actorRef: ActorRefFrom<TLogic>;
};
export function useActor(
  actorLogic: AnyActorLogic,
  options: ActorOptions<AnyActorLogic> = {}
) {
  if (
    isDevelopment &&
    'send' in actorLogic &&
    typeof actorLogic.send === 'function'
  ) {
    throw new Error(
      `useActor() expects actor logic (e.g. a machine), but received an ActorRef. Use the useSelector(actorRef, ...) hook instead to read the ActorRef's snapshot.`
    );
  }

  function listener(nextSnapshot: Snapshot<unknown>) {
    snapshot.value = nextSnapshot;
  }

  const actorRef = useActorRef(actorLogic, options, listener);
  const snapshot = useSelector(actorRef, (s) => s);

  return {
    snapshot,
    send: actorRef.send,
    actorRef: actorRef
  };
}
