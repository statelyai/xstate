import {
  ActorRefFrom,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  EventFromLogic,
  InterpreterOptions,
  MissingImplementationsError,
  SnapshotFrom
} from 'xstate';
import { Readable } from 'svelte/store';
import { useActor } from './useActor.ts';

export function useMachine<TMachine extends AnyStateMachine>(
  machine: AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends true
    ? TMachine
    : MissingImplementationsError<TMachine['__TResolvedTypesMeta']>,
  options: InterpreterOptions<TMachine> = {}
): {
  snapshot: Readable<SnapshotFrom<TMachine>>;
  send: (event: EventFromLogic<TMachine>) => void;
  actorRef: ActorRefFrom<TMachine>;
} {
  return useActor(machine as any, options) as any;
}
