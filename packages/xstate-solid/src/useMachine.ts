import type { AnyStateMachine, StateFrom, InterpreterFrom, Prop } from 'xstate';
import type { CheckSnapshot, RestParams } from './types.js';
import { createService } from './createService.js';
import { onCleanup, onMount } from 'solid-js';
import { deriveServiceState } from './deriveServiceState.js';
import { createImmutable } from './createImmutable.js';
import { unwrap } from 'solid-js/store';

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
    deriveServiceState(service.getSnapshot())
  );

  onMount(() => {
    const { unsubscribe } = service.subscribe((nextState) => {
      setState(
        deriveServiceState(nextState, unwrap(state)) as StateFrom<TMachine>
      );
    });

    onCleanup(unsubscribe);
  });

  return [state, service.send, service] as UseMachineReturn<TMachine>;
}
