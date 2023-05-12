import { Ref, shallowRef } from 'vue';
import {
  ActorRefFrom,
  AnyActorBehavior,
  EventFrom,
  SnapshotFrom
} from 'xstate';
import { UseActorRefRestParams, useActorRef } from './useActorRef.ts';

export function useMachine<TBehavior extends AnyActorBehavior>(
  behavior: TBehavior,
  ...[options = {}]: UseActorRefRestParams<TBehavior>
): {
  snapshot: Ref<SnapshotFrom<TBehavior>>;
  send: (event: EventFrom<TBehavior>) => void;
  actorRef: ActorRefFrom<TBehavior>;
} {
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
