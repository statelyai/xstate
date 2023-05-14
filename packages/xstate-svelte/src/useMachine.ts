import { onDestroy } from 'svelte';
import { Readable, readable } from 'svelte/store';
import {
  ActorRefFrom,
  AnyActorBehavior,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  EventFromBehavior,
  InternalMachineImplementations,
  interpret,
  InterpreterOptions,
  SnapshotFrom
} from 'xstate';

type RestParams<TMachine extends AnyActorBehavior> =
  TMachine extends AnyStateMachine
    ? AreAllImplementationsAssumedToBeProvided<
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
        ]
    : [options?: InterpreterOptions<TMachine>];

export function useActor<TBehavior extends AnyActorBehavior>(
  behavior: TBehavior,
  ...[options = {}]: RestParams<TBehavior>
): {
  snapshot: Readable<SnapshotFrom<TBehavior>>;
  send: (event: EventFromBehavior<TBehavior>) => void;
  actorRef: ActorRefFrom<TBehavior>;
} {
  const actorRef = interpret(behavior, options).start();

  onDestroy(() => actorRef.stop());

  const snapshot = readable(actorRef.getSnapshot(), (set) => {
    return actorRef.subscribe((state) => {
      set(state);
    }).unsubscribe;
  });

  return {
    snapshot,
    send: actorRef.send,
    actorRef: actorRef as ActorRefFrom<TBehavior>
  };
}

export const useMachine = useActor;
