import { onBeforeUnmount, onMounted } from 'vue';
import {
  Observer,
  State,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineImplementations,
  interpret,
  InterpreterFrom,
  InterpreterOptions,
  StateFrom
} from 'xstate';
import { MaybeLazy, UseMachineOptions } from './types';

// copied from core/src/utils.ts
// it avoids a breaking change between this package and XState which is its peer dep
function toObserver<T>(
  nextHandler: Observer<T> | ((value: T) => void),
  errorHandler?: (error: any) => void,
  completionHandler?: () => void
): Observer<T> {
  if (typeof nextHandler === 'object') {
    return nextHandler;
  }

  const noop = () => void 0;

  return {
    next: nextHandler,
    error: errorHandler || noop,
    complete: completionHandler || noop
  };
}

type RestParams<
  TMachine extends AnyStateMachine
> = AreAllImplementationsAssumedToBeProvided<
  TMachine['__TResolvedTypesMeta']
> extends false
  ? [
      options: InterpreterOptions &
        UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
        InternalMachineImplementations<
          TMachine['__TContext'],
          TMachine['__TEvent'],
          TMachine['__TResolvedTypesMeta'],
          true
        >,
      observerOrListener?:
        | Observer<StateFrom<TMachine>>
        | ((value: StateFrom<TMachine>) => void)
    ]
  : [
      options?: InterpreterOptions &
        UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
        InternalMachineImplementations<
          TMachine['__TContext'],
          TMachine['__TEvent'],
          TMachine['__TResolvedTypesMeta']
        >,
      observerOrListener?:
        | Observer<StateFrom<TMachine>>
        | ((value: StateFrom<TMachine>) => void)
    ];

export function useInterpret<TMachine extends AnyStateMachine>(
  getMachine: MaybeLazy<TMachine>,
  ...[options = {}, observerOrListener]: RestParams<TMachine>
): InterpreterFrom<TMachine> {
  const machine = typeof getMachine === 'function' ? getMachine() : getMachine;

  const {
    context,
    guards,
    actions,
    actors,
    delays,
    state: rehydratedState,
    ...interpreterOptions
  } = options;

  const machineConfig = {
    context,
    guards,
    actions,
    actors,
    delays
  };

  const machineWithConfig = machine.provide({
    ...machineConfig,
    context
  } as any);

  const service = interpret(machineWithConfig, interpreterOptions).start(
    rehydratedState ? (State.create(rehydratedState) as any) : undefined
  );

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

  return service as any;
}
