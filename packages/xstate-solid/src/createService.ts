import { onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';
import type { Actor, ActorOptions, AnyStateMachine } from 'xstate';
import { createActor } from 'xstate';

export function createService<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: ActorOptions<TMachine>
): Actor<TMachine> {
  const actorRef = createActor(machine, options);

  if (!isServer) {
    actorRef.start();
    onCleanup(() => actorRef.stop());
  }

  return actorRef;
}
