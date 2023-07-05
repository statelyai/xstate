import {
  ActorRefFrom,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  EventFrom,
  InterpreterOptions,
  MissingImplementationsError,
  SnapshotFrom
} from 'xstate';
import { useActor } from './useActor.ts';
import { Ref } from 'vue';

/**
 * @alias useActor
 */
export function useMachine<TMachine extends AnyStateMachine>(
  machine: AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends true
    ? TMachine
    : MissingImplementationsError<TMachine['__TResolvedTypesMeta']>,
  options: InterpreterOptions<TMachine> = {}
): {
  snapshot: Ref<SnapshotFrom<TMachine>>;
  send: (event: EventFrom<TMachine>) => void;
  actorRef: ActorRefFrom<TMachine>;
} {
  return useActor(machine as any, options) as any;
}
