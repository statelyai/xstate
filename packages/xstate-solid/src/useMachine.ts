import type { AnyStateMachine, StateFrom, Actor, Prop } from 'xstate';
import type { CheckSnapshot, RestParams } from './types.ts';
import { createService } from './createService.ts';
import { onCleanup, onMount } from 'solid-js';
import { deriveServiceState } from './deriveServiceState.ts';
import { createImmutable } from './createImmutable.ts';
import { unwrap } from 'solid-js/store';

type UseMachineReturn<
  TMachine extends AnyStateMachine,
  TInterpreter = Actor<TMachine>
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
