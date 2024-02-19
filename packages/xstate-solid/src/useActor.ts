import { onCleanup, onMount } from 'solid-js';
import {
  EventFromLogic,
  type ActorOptions,
  type ActorRefFrom,
  type AnyActorLogic,
  type AnyActorRef,
  type SnapshotFrom
} from 'xstate';
import { createImmutable } from './createImmutable.ts';
import { useActorRef } from './useActorRef.ts';

export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: ActorOptions<TLogic>
): [
  SnapshotFrom<TLogic>,
  (event: EventFromLogic<TLogic>) => void,
  ActorRefFrom<TLogic>
] {
  const actorRef = useActorRef(logic, options) as AnyActorRef;
  const [snapshot, setSnapshot] = createImmutable(actorRef.getSnapshot());

  onMount(() => {
    const { unsubscribe } = actorRef.subscribe(setSnapshot);
    onCleanup(unsubscribe);
  });

  return [snapshot, actorRef.send, actorRef as any];
}
