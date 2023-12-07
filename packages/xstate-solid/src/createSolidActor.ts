import type { Actor, ActorOptions, AnyActorLogic } from 'xstate';
import { createActor } from 'xstate';
import { onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';

export function createSolidActor<TActorLogic extends AnyActorLogic>(
  machine: TActorLogic,
  actorOptions: ActorOptions<TActorLogic> = {}
): Actor<TActorLogic> {
  const actorRef = createActor(machine, actorOptions);

  if (!isServer) {
    actorRef.start();
    onCleanup(() => actorRef.stop());
  }

  return actorRef as unknown as Actor<TActorLogic>;
}
