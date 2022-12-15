import type { AnyState, AnyStateMachine, StateFrom } from 'xstate';
import type { CheckSnapshot, RestParams } from './types';
import { createService } from './createService';
import { onCleanup, onMount } from 'solid-js';
import type { InterpreterFrom, Prop } from 'xstate';
import { deriveServiceState } from './deriveServiceState';
import { createImmutable } from './createImmutable';
import { State } from 'xstate';

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
  const initialState = (options.state
    ? State.create(options.state)
    : service.machine.initialState) as AnyState;

  const [state, setState] = createImmutable(deriveServiceState(initialState));

  onMount(() => {
    const { unsubscribe } = service.subscribe((nextState) => {
      setState(deriveServiceState(nextState) as StateFrom<TMachine>);
    });

    onCleanup(unsubscribe);
  });

  return [state, service.send, service] as UseMachineReturn<TMachine>;
}
