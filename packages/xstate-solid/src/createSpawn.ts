import { onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';
import {
  ActorRef,
  ActorLogic,
  EventObject,
  createActor,
  ActorInternalState
} from 'xstate';

export function createSpawn<
  TState,
  TEvent extends EventObject,
  TInput,
  TOutput,
  TPersisted
>(
  logic: ActorLogic<
    TState,
    TEvent,
    TInput,
    TOutput,
    ActorInternalState<TState, TOutput>,
    TPersisted
  >
): ActorRef<TEvent, TState> {
  const actorRef = createActor(logic);

  if (!isServer) {
    actorRef.start?.();
    onCleanup(() => actorRef!.stop?.());
  }

  return actorRef;
}
