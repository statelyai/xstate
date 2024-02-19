import { onCleanup, onMount } from 'solid-js';
import {
  ActorLogic,
  ActorRef,
  EventObject,
  Snapshot,
  createActor
} from 'xstate';

export function createSpawn<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
>(logic: ActorLogic<TSnapshot, TEvent, TInput>): ActorRef<TSnapshot, TEvent> {
  const actorRef = createActor(logic);

  onMount(() => {
    actorRef.start();
    onCleanup(() => actorRef!.stop?.());
  });

  return actorRef;
}
