import { Ref, shallowRef } from 'vue';
import {
  ActorRefFrom,
  AnyActorBehavior,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  EventFrom,
  InternalMachineImplementations,
  InterpreterFrom,
  InterpreterOptions,
  SnapshotFrom,
  StateFrom
} from 'xstate';
import { MaybeLazy, Prop } from './types.ts';
import { UseActorRefRestParams, useActorRef } from './useActorRef.ts';

type RestParams<TMachine extends AnyStateMachine> =
  AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends false
    ? [
        options: InterpreterOptions<TMachine> &
          InternalMachineImplementations<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TMachine['__TResolvedTypesMeta'],
            true
          >
      ]
    : [
        options?: InterpreterOptions<TMachine> &
          InternalMachineImplementations<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TMachine['__TResolvedTypesMeta']
          >
      ];

export function useMachine<TMachine extends AnyActorBehavior>(
  behavior: TMachine,
  ...[options = {}]: UseActorRefRestParams<TMachine>
): {
  snapshot: Ref<SnapshotFrom<TMachine>>;
  send: (event: EventFrom<TMachine>) => void;
  actorRef: ActorRefFrom<TMachine>;
} {
  function listener(nextState: SnapshotFrom<TMachine>) {
    snapshot.value = nextState;
  }

  const actorRef = useActorRef(behavior, options, listener);

  const snapshot = shallowRef(actorRef.getSnapshot());

  return { snapshot, send: actorRef.send, actorRef };
}
