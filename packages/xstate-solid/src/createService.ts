import type { AnyStateMachine, InterpreterFrom } from 'xstate';
import { interpret } from 'xstate';
import type { RestParams } from './types.js';
import { onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';

export function createService<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options = {}]: RestParams<TMachine>
): InterpreterFrom<TMachine> {
  const {
    context,
    guards,
    actions,
    actors,
    delays,
    state: rehydratedState,
    ...interpreterOptions
  } = options;

  const machineConfig = {
    context,
    guards,
    actions,
    actors,
    delays
  };

  const machineWithConfig = machine.provide(machineConfig as any);

  const service = interpret(machineWithConfig, interpreterOptions);

  if (!isServer) {
    service.start(
      rehydratedState
        ? ((service.behavior as AnyStateMachine).createState(
            rehydratedState
          ) as any)
        : undefined
    );
    onCleanup(() => service.stop());
  }

  return service as InterpreterFrom<TMachine>;
}
