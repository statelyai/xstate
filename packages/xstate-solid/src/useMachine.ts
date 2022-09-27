import type { AnyStateMachine, StateFrom } from 'xstate';
import type { CheckSnapshot, RestParams } from './types';
import { createService } from './createService';
import { createRenderEffect, onCleanup } from 'solid-js';
import type { InterpreterFrom, Prop } from 'xstate';
import { deriveServiceState } from './deriveServiceState';
import { createImmutable } from './createImmutable';

type UseMachineReturn<
  TMachine extends AnyStateMachine,
  TInterpreter = InterpreterFrom<TMachine>
> = [
  CheckSnapshot<StateFrom<TMachine>>,
  Prop<TInterpreter, 'send'>,
  TInterpreter
];

export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options = {}]: RestParams<TMachine>
): UseMachineReturn<TMachine> {
  const service = createService(machine, options);

  const [state, setState] = createImmutable(
    deriveServiceState(service, service.state)
  );

  createRenderEffect(() => {
    const { unsubscribe } = service.subscribe((nextState) => {
      setState(deriveServiceState(service, nextState) as StateFrom<TMachine>);
    });

    onCleanup(unsubscribe);
  });

  return [state, service.send, service] as UseMachineReturn<TMachine>;
}
