import type { Actor, ActorOptions, AnyStateMachine } from 'xstate';
import { createActor } from 'xstate';
import { onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';

export function createService<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: ActorOptions<TMachine>
): Actor<TMachine> {
  const service = createActor(machine, options);

  if (!isServer) {
    service.start();
    onCleanup(() => service.stop());
  }

  return service as unknown as Actor<TMachine>;
}
