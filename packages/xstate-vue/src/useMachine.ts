import { Ref, shallowRef } from 'vue';
import {
  ActorRefFrom,
  AnyActorBehavior,
  EventFrom,
  SnapshotFrom
} from 'xstate';
import { UseActorRefRestParams, useActorRef } from './useActorRef.ts';
import { isActorRef } from 'xstate/actors';

export function useActor<TBehavior extends AnyActorBehavior>(
  behavior: TBehavior,
  ...[options = {}]: UseActorRefRestParams<TBehavior>
): {
  snapshot: Ref<SnapshotFrom<TBehavior>>;
  send: (event: EventFrom<TBehavior>) => void;
  actorRef: ActorRefFrom<TBehavior>;
} {
  if (process.env.NODE_ENV !== 'production') {
    if (isActorRef(behavior)) {
      throw new Error(
        `useActor() expects actor logic (e.g. a machine), but received an ActorRef. Use the useSelector(actorRef, ...) hook instead to read the ActorRef's snapshot.`
      );
    }
  }

  function listener(nextState: SnapshotFrom<TBehavior>) {
    snapshot.value = nextState;
  }

  const actorRef = useActorRef(behavior, options, listener);
  const snapshot = shallowRef(actorRef.getSnapshot());

  return {
    snapshot,
    send: actorRef.send,
    actorRef: actorRef as ActorRefFrom<TBehavior>
  };
}

export const useMachine = useActor;
