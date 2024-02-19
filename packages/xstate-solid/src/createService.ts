import { onCleanup, onMount } from 'solid-js';
import type { Actor, ActorOptions, AnyStateMachine } from 'xstate';
import { createActor } from 'xstate';

export function createService<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: ActorOptions<TMachine>
): Actor<TMachine> {
  const actorRef = createActor(machine, options);

  onMount(() => {
    actorRef.start();
    onCleanup(() => actorRef.stop());
  });

  return actorRef;
}
