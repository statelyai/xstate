import { Ref } from 'vue';
import {
  Actor,
  ActorOptions,
  AnyStateMachine,
  EventFrom,
  SnapshotFrom
} from 'xstate';
import { useActor } from './useActor.ts';

/**
 * @alias useActor
 */
export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options: ActorOptions<TMachine> = {}
): {
  snapshot: Ref<SnapshotFrom<TMachine>>;
  send: (event: EventFrom<TMachine>) => void;
  actorRef: Actor<TMachine>;
} {
  return useActor(machine, options);
}
