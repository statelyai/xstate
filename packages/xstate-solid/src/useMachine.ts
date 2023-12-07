import type {
  AnyStateMachine,
  Actor,
  Prop,
  SnapshotFrom,
  ActorOptions,
  AnyActorLogic
} from 'xstate';
import type { RestParams } from './types.ts';
import { createSolidActor } from './createSolidActor.ts';
import { onCleanup, onMount } from 'solid-js';
import { createImmutable } from './createImmutable.ts';

type UseMachineReturn<
  TMachine extends AnyActorLogic,
  TInterpreter = Actor<TMachine>
> = [SnapshotFrom<TMachine>, Prop<TInterpreter, 'send'>, TInterpreter];

export function useMachine<TMachine extends AnyActorLogic>(
  machine: TMachine,
  options: ActorOptions<TMachine> = {}
): UseMachineReturn<TMachine> {
  const service = createSolidActor(machine, options);

  const [state, setState] = createImmutable(service.getSnapshot());

  onMount(() => {
    const { unsubscribe } = service.subscribe((nextState) => {
      setState(nextState);
    });

    onCleanup(unsubscribe);
  });

  return [state, service.send, service] as UseMachineReturn<TMachine>;
}
