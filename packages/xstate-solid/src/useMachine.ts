import type { AnyStateMachine, Actor, Prop, SnapshotFrom } from 'xstate';
import type { RestParams } from './types.ts';
import { createService } from './createService.ts';
import { onCleanup, onMount } from 'solid-js';
import { createImmutable } from './createImmutable.ts';

type UseMachineReturn<
  TMachine extends AnyStateMachine,
  TInterpreter = Actor<TMachine>
> = [SnapshotFrom<TMachine>, Prop<TInterpreter, 'send'>, TInterpreter];

export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options = {}]: RestParams<TMachine>
): UseMachineReturn<TMachine> {
  const service = createService(machine, options);

  const [state, setState] = createImmutable(service.getSnapshot());

  onMount(() => {
    const { unsubscribe } = service.subscribe((nextState) => {
      setState(nextState);
    });

    onCleanup(unsubscribe);
  });

  return [state, service.send, service] as UseMachineReturn<TMachine>;
}
