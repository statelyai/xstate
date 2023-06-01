import type {
  AnyActorLogic,
  SnapshotFrom,
  EventFromLogic,
  SimpleActorRefFrom
} from 'xstate';
import type { CheckSnapshot, RestParams } from './types.ts';
import { createActorRef } from './createActorRef.ts';
import { onCleanup, onMount } from 'solid-js';
import { deriveServiceState } from './deriveServiceState.ts';
import { createImmutable } from './createImmutable.ts';
import { unwrap } from 'solid-js/store';

export function useActor<TLogic extends AnyActorLogic>(
  machine: TLogic,
  ...[options = {}]: RestParams<TLogic>
): [
  CheckSnapshot<SnapshotFrom<TLogic>>,
  (event: EventFromLogic<TLogic>) => void,
  SimpleActorRefFrom<TLogic>
] {
  const actorRef = createActorRef(
    machine,
    options
  ) as SimpleActorRefFrom<TLogic>;

  const [snapshot, setSnapshot] = createImmutable(
    deriveServiceState(actorRef.getSnapshot()) as SnapshotFrom<TLogic>
  );

  onMount(() => {
    const { unsubscribe } = actorRef.subscribe((nextState) => {
      setSnapshot(deriveServiceState(nextState, unwrap(snapshot)));
    });

    onCleanup(unsubscribe);
  });

  return [snapshot, actorRef.send, actorRef];
}

export const useMachine = useActor;
