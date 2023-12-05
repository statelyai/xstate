import isDevelopment from '#is-development';
import {
  ActorRefFrom,
  AnyActorLogic,
  ActorOptions,
  SnapshotFrom
} from 'xstate';
import { useActorRef } from './useActorRef.ts';
import { useSelector } from './useSelector.ts';

function identity<T>(value: T) {
  return value;
}

export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options: ActorOptions<TLogic> = {}
): [SnapshotFrom<TLogic>, ActorRefFrom<TLogic>['send'], ActorRefFrom<TLogic>] {
  if (
    isDevelopment &&
    !!logic &&
    'send' in logic &&
    typeof logic.send === 'function'
  ) {
    throw new Error(
      `useActor() expects actor logic (e.g. a machine), but received an ActorRef. Use the useSelector(actorRef, ...) hook instead to read the ActorRef's snapshot.`
    );
  }

  const actorRef = useActorRef(logic, options as any);
  const snapshot = useSelector(actorRef, identity);

  return [snapshot, actorRef.send.bind(actorRef), actorRef];
}
