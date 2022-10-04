import type { AnyStateMachine, InterpreterFrom } from 'xstate';
import { interpret, State } from 'xstate';
import type { RestParams } from './types';
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
    activities,
    services,
    delays,
    state: rehydratedState,
    ...interpreterOptions
  } = options;

  const machineConfig = {
    guards,
    actions,
    activities,
    services,
    delays
  };

  const machineWithConfig = machine.withConfig(machineConfig as any, () => ({
    ...machine.context,
    ...context
  }));

  const service = interpret(machineWithConfig, interpreterOptions);

  if (!isServer) {
    service.start(rehydratedState ? State.create(rehydratedState) : undefined);
    onCleanup(() => service.stop());
  }

  return service as InterpreterFrom<TMachine>;
}
