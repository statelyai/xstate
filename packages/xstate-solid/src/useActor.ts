import { onCleanup, onMount } from 'solid-js';
import { unwrap } from 'solid-js/store';
import type {
  ActorRefFrom,
  AnyActorLogic,
  EventFromLogic,
  SnapshotFrom
} from 'xstate';
import { createActorRef } from './createActorRef.ts';
import { createImmutable } from './createImmutable.ts';
import { deriveServiceState } from './deriveServiceState.ts';
import type { CheckSnapshot, RestParams } from './types.ts';

export function useActor<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  ...[options = {}]: RestParams<TLogic>
): [
  CheckSnapshot<SnapshotFrom<TLogic>>,
  (event: EventFromLogic<TLogic>) => void,
  ActorRefFrom<TLogic>
] {
  const actorRef = createActorRef(actorLogic, options);

  const [snapshot, setSnapshot] = createImmutable(
    deriveServiceState(actorRef.getSnapshot()) as SnapshotFrom<TLogic>
  );

  onMount(() => {
    const { unsubscribe } = actorRef.subscribe((nextState) => {
      setSnapshot(deriveServiceState(nextState, unwrap(snapshot)));
    });

    onCleanup(unsubscribe);
  });

  return [snapshot, actorRef.send, actorRef as any];
}

export const useMachine = useActor;
