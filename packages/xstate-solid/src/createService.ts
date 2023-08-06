import type { Actor, AnyStateMachine } from 'xstate';
import { createActor } from 'xstate';
import type { RestParams } from './types.ts';
import { onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';

export function createService<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options = {}]: RestParams<TMachine>
): Actor<TMachine> {
  const { guards, actions, actors, delays, ...interpreterOptions } = options;

  const machineConfig = {
    guards,
    actions,
    actors,
    delays
  };

  const machineWithConfig = machine.provide(machineConfig as any);

  const service = createActor(machineWithConfig, interpreterOptions);

  if (!isServer) {
    service.start();
    onCleanup(() => service.stop());
  }

  return service as unknown as Actor<TMachine>;
}
