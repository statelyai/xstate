import type { AnyStateMachine, StateFrom } from 'xstate';
import { createStore } from 'solid-js/store';
import type { RestParams } from './types';
import { createService } from './createService';
import { onCleanup, onMount } from 'solid-js';
import { InterpreterFrom, Prop } from 'xstate';
import { deriveServiceState, updateState } from './stateUtils';
import { deepClone } from './utils';

type UseMachineReturnTuple<
  TMachine extends AnyStateMachine,
  TInterpreter = InterpreterFrom<TMachine>
> = [StateFrom<TMachine>, Prop<TInterpreter, 'send'>, TInterpreter];

export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options = {}]: RestParams<TMachine>
): UseMachineReturnTuple<TMachine> {
  const service = createService(machine, options);

  const [state, setState] = createStore(
    deriveServiceState(
      service,
      deepClone({ ...service.state }) as StateFrom<TMachine>
    )
  );

  onMount(() => {
    const { unsubscribe } = service.subscribe((nextState) => {
      updateState(nextState, setState);
    });

    onCleanup(unsubscribe);
  });

  return [state, service.send, service] as UseMachineReturnTuple<TMachine>;
}
