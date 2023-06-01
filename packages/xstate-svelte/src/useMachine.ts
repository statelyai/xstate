import { onDestroy } from 'svelte';
import { Readable, readable } from 'svelte/store';
import {
  ActorRefFrom,
  AnyActorLogic,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  EventFromLogic,
  InternalMachineImplementations,
  interpret,
  InterpreterOptions,
  SnapshotFrom
} from 'xstate';
import { isActorRef } from 'xstate/actors';

type RestParams<TMachine extends AnyActorLogic> =
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

export function useActor<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  ...[options = {}]: RestParams<TLogic>
): {
  snapshot: Readable<SnapshotFrom<TLogic>>;
  send: (event: EventFromLogic<TLogic>) => void;
  actorRef: ActorRefFrom<TLogic>;
} {
  if (process.env.NODE_ENV !== 'production') {
    if (isActorRef(actorLogic)) {
      throw new Error(
        `useActor() expects actor logic (e.g. a machine), but received an ActorRef. Use the useSelector(actorRef, ...) hook instead to read the ActorRef's snapshot.`
      );
    }
  }
  const actorRef = interpret(actorLogic, options).start();

  onDestroy(() => actorRef.stop());

  const snapshot = readable(actorRef.getSnapshot(), (set) => {
    return actorRef.subscribe((state) => {
      set(state);
    }).unsubscribe;
  });

  return {
    snapshot,
    send: actorRef.send,
    actorRef: actorRef as ActorRefFrom<TLogic>
  };
}

export const useMachine = useActor;
