import type {
  EventObject,
  StateMachine,
  Interpreter,
  InterpreterOptions,
  MachineOptions,
  Typestate,
  Observer
} from 'xstate';
import { State, interpret } from 'xstate';
import type { UseMachineOptions, MaybeLazy } from './types';
import { onCleanup, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';

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

export function useInterpret<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  getMachine: MaybeLazy<StateMachine<TContext, any, TEvent, TTypestate>>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineOptions<TContext, TEvent>> = {},
  observerOrListener?:
    | Observer<State<TContext, TEvent, any, TTypestate>>
    | ((value: State<TContext, TEvent, any, TTypestate>) => void)
): Interpreter<TContext, any, TEvent, TTypestate> {
  const machine = typeof getMachine === 'function' ? getMachine() : getMachine;

  const {
    context,
    guards,
    actions,
    activities,
    services,
    delays,
    state: rehydratedState,
    ...interpreterOptions
  } = options;

  const machineConfig = {
    context,
    guards,
    actions,
    activities,
    services,
    delays
  };

  const machineWithConfig = machine.withConfig(machineConfig, () => ({
    ...machine.context,
    ...context
  }));

  const [service] = createStore(
    interpret(machineWithConfig, {
      deferEvents: true,
      ...interpreterOptions
    }).start(
      rehydratedState ? (State.create(rehydratedState) as any) : undefined
    )
  );

  let sub;
  onMount(() => {
    if (observerOrListener) {
      sub = service.subscribe(toObserver(observerOrListener));
    }
  });

  onCleanup(() => {
    service.stop();
    sub?.unsubscribe();
  });

  return (service as unknown) as Interpreter<TContext, any, TEvent, TTypestate>;
}
