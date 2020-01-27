import {
  ref,
  watch,
  isRef,
  onBeforeMount,
  onBeforeUnmount,
  Ref
} from '@vue/composition-api';
import {
  interpret,
  EventObject,
  StateMachine,
  State,
  Interpreter,
  InterpreterOptions,
  MachineOptions,
  StateConfig
} from 'xstate';

interface UseMachineOptions<TContext, TEvent extends EventObject> {
  /**
   * If provided, will be merged with machine's `context`.
   */
  context?: Partial<TContext>;
  /**
   * The state to rehydrate the machine to. The machine will
   * start at this state instead of its `initialState`.
   */
  state?: StateConfig<TContext, TEvent>;
}

export function useMachine<TContext, TEvent extends EventObject>(
  machine: StateMachine<TContext, any, TEvent>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineOptions<TContext, TEvent>>
): {
  current: Ref<State<TContext, TEvent>>;
  send: Interpreter<TContext, any, TEvent>['send'];
  service: Interpreter<TContext, any, TEvent>;
} {
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

  const machineWithConfig = machine.withConfig(machineConfig, {
    ...machine.context,
    ...context
  } as TContext);

  const service = interpret(machineWithConfig, interpreterOptions).onTransition(
    state => {
      if (state.changed) {
        current.value = state;
      }
    }
  );

  const initialState = rehydratedState
    ? State.create(rehydratedState)
    : service.initialState;

  const current = ref<State<TContext, TEvent>>(initialState);

  // extract send method for sending events to the service
  const send = (event: TEvent | TEvent['type']) => service.send(event);

  onBeforeMount(() => {
    service.start(rehydratedState ? initialState : undefined);
  });

  onBeforeUnmount(() => {
    service.stop();
  });

  return {
    current,
    service,
    send
  };
}

export function useService<TContext, TEvent extends EventObject>(
  service:
    | Interpreter<TContext, any, TEvent>
    | Ref<Interpreter<TContext, any, TEvent>>
): {
  current: Ref<State<TContext, TEvent>>;
  send: Interpreter<TContext, any, TEvent>['send'];
  service: Ref<Interpreter<TContext, any, TEvent>>;
} {
  const serviceRef = isRef(service)
    ? service
    : ref<Interpreter<TContext, any, TEvent>>(service);
  const current = ref<State<TContext, TEvent>>(serviceRef.value.state);

  watch(serviceRef, (service, _, onCleanup) => {
    current.value = service.state;
    const { unsubscribe } = service.subscribe(state => {
      if (state.changed) {
        current.value = state;
      }
    });
    onCleanup(() => unsubscribe());
  });

  const send = (event: TEvent | TEvent['type']) => serviceRef.value.send(event);

  return {
    current,
    send,
    service: serviceRef
  };
}
