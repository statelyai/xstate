import { onCleanup, onMount } from 'solid-js';
import type {
  Actor,
  ActorOptions,
  AnyStateMachine,
  Prop,
  SnapshotFrom
} from 'xstate';
import { createImmutable } from './createImmutable.ts';
import { createService } from './createService.ts';

type UseMachineReturn<
  TMachine extends AnyStateMachine,
  TInterpreter = Actor<TMachine>
> = [SnapshotFrom<TMachine>, Prop<TInterpreter, 'send'>, TInterpreter];

export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: ActorOptions<TMachine>
): UseMachineReturn<TMachine> {
  const service = createService(machine, options);

  const [state, setState] = createImmutable(service.getSnapshot());

  onMount(() => {
    const { unsubscribe } = service.subscribe((nextState) => {
      setState(nextState);
    });

    onCleanup(unsubscribe);
  });

  return [state, service.send, service];
}
