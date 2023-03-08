import type { AnyStateMachine, InterpreterFrom } from 'xstate';
import { interpret } from 'xstate';
import type { RestParams } from './types.js';
import { onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';

export function createService<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options = {}]: RestParams<TMachine>
): InterpreterFrom<TMachine> {
  const { guards, actions, actors, delays, ...interpreterOptions } = options;

  const machineConfig = {
    guards,
    actions,
    actors,
    delays
  };

  const machineWithConfig = machine.provide(machineConfig as any);

  const service = interpret(machineWithConfig, interpreterOptions);

  if (!isServer) {
    service.start();
    onCleanup(() => service.stop());
  }

  return service as unknown as InterpreterFrom<TMachine>;
}
