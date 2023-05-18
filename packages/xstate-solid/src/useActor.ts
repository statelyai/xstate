import type {
  AnyActorBehavior,
  SnapshotFrom,
  EventFromBehavior,
  ActorRefFrom
} from 'xstate';
import type { CheckSnapshot, RestParams } from './types.ts';
import { createActorRef } from './createActorRef.ts';
import { onCleanup, onMount } from 'solid-js';
import { deriveServiceState } from './deriveServiceState.ts';
import { createImmutable } from './createImmutable.ts';
import { unwrap } from 'solid-js/store';

export function useActor<TBehavior extends AnyActorBehavior>(
  machine: TBehavior,
  ...[options = {}]: RestParams<TBehavior>
): [
  CheckSnapshot<SnapshotFrom<TBehavior>>,
  (event: EventFromBehavior<TBehavior>) => void,
  ActorRefFrom<TBehavior>
] {
  const actorRef = createActorRef(machine, options) as ActorRefFrom<TBehavior>;

  const [snapshot, setSnapshot] = createImmutable(
    deriveServiceState(actorRef.getSnapshot())
  );

  onMount(() => {
    const { unsubscribe } = actorRef.subscribe((nextState) => {
      setSnapshot(
        deriveServiceState(
          nextState,
          unwrap(snapshot)
        ) as SnapshotFrom<TBehavior>
      );
    });

    onCleanup(unsubscribe);
  });

  return [snapshot, actorRef.send, actorRef];
}

export const useMachine = useActor;
