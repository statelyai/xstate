import { onBeforeUnmount, onMounted } from 'vue';
import {
  ActorRefFrom,
  AnyActorLogic,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineImplementations,
  interpret,
  InterpreterOptions,
  Observer,
  SnapshotFrom,
  StateFrom,
  toObserver
} from 'xstate';

export type UseActorRefRestParams<TLogic extends AnyActorLogic> =
  TLogic extends AnyStateMachine
    ? AreAllImplementationsAssumedToBeProvided<
        TLogic['__TResolvedTypesMeta']
      > extends false
      ? [
          options: InterpreterOptions<TLogic> &
            InternalMachineImplementations<
              TLogic['__TContext'],
              TLogic['__TEvent'],
              TLogic['__TResolvedTypesMeta'],
              true
            >,
          observerOrListener?:
            | Observer<StateFrom<TLogic>>
            | ((value: StateFrom<TLogic>) => void)
        ]
      : [
          options?: InterpreterOptions<TLogic> &
            InternalMachineImplementations<
              TLogic['__TContext'],
              TLogic['__TEvent'],
              TLogic['__TResolvedTypesMeta']
            >,
          observerOrListener?:
            | Observer<StateFrom<TLogic>>
            | ((value: StateFrom<TLogic>) => void)
        ]
    : [
        options?: InterpreterOptions<TLogic>,
        observerOrListener?:
          | Observer<SnapshotFrom<TLogic>>
          | ((value: SnapshotFrom<TLogic>) => void)
      ];

export function useActorRef<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  ...[options = {}, observerOrListener]: UseActorRefRestParams<TLogic>
): ActorRefFrom<TLogic> {
  const service = interpret(actorLogic, options).start();

  let sub;
  onMounted(() => {
    if (observerOrListener) {
      sub = service.subscribe(toObserver(observerOrListener as any));
    }
  });

  onBeforeUnmount(() => {
    service.stop();
    sub?.unsubscribe();
  });

  return service as ActorRefFrom<TLogic>;
}
