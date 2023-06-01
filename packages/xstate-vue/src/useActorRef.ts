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

export type UseActorRefRestParams<TBehavior extends AnyActorLogic> =
  TBehavior extends AnyStateMachine
    ? AreAllImplementationsAssumedToBeProvided<
        TBehavior['__TResolvedTypesMeta']
      > extends false
      ? [
          options: InterpreterOptions<TBehavior> &
            InternalMachineImplementations<
              TBehavior['__TContext'],
              TBehavior['__TEvent'],
              TBehavior['__TResolvedTypesMeta'],
              true
            >,
          observerOrListener?:
            | Observer<StateFrom<TBehavior>>
            | ((value: StateFrom<TBehavior>) => void)
        ]
      : [
          options?: InterpreterOptions<TBehavior> &
            InternalMachineImplementations<
              TBehavior['__TContext'],
              TBehavior['__TEvent'],
              TBehavior['__TResolvedTypesMeta']
            >,
          observerOrListener?:
            | Observer<StateFrom<TBehavior>>
            | ((value: StateFrom<TBehavior>) => void)
        ]
    : [
        options?: InterpreterOptions<TBehavior>,
        observerOrListener?:
          | Observer<SnapshotFrom<TBehavior>>
          | ((value: SnapshotFrom<TBehavior>) => void)
      ];

export function useActorRef<TBehavior extends AnyActorLogic>(
  behavior: TBehavior,
  ...[options = {}, observerOrListener]: UseActorRefRestParams<TBehavior>
): ActorRefFrom<TBehavior> {
  const service = interpret(behavior, options).start();

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

  return service as ActorRefFrom<TBehavior>;
}
