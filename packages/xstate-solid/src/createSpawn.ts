import { onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';
import {
  ActorRef,
  ActorLogic,
  EventObject,
  createActor,
  Snapshot
} from 'xstate';

export function createSpawn<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
>(logic: ActorLogic<TSnapshot, TEvent, TInput>): ActorRef<TEvent, TSnapshot> {
  const actorRef = createActor(logic);

  if (!isServer) {
    actorRef.start();
    onCleanup(() => actorRef!.stop?.());
  }

  return actorRef;
}
