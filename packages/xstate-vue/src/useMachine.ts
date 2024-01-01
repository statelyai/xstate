import { Ref } from 'vue';
import {
  ActorOptions,
  ActorRefFrom,
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
  actorRef: ActorRefFrom<TMachine>;
} {
  return useActor(machine as any, options) as any;
}
