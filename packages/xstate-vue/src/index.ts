import {
  ref,
  watch,
  isRef,
  onMounted,
  onBeforeUnmount,
  Ref
} from '@vue/composition-api';
import {
  interpret,
  EventObject,
  MachineNode,
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
  machine: MachineNode<TContext, any, TEvent>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineOptions<TContext, TEvent>> = {}
): {
  state: Ref<State<TContext, TEvent>>;
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

  const createdMachine = machine.withConfig({
    ...machineConfig,
    context
  });

  const service = interpret(createdMachine, interpreterOptions).start(
    rehydratedState ? State.create(rehydratedState) : undefined
  );

  const state = ref<State<TContext, TEvent>>(service.state);

  onMounted(() => {
    service.onTransition((currentState) => {
      if (currentState.changed) {
        state.value = currentState;
      }
    });

    state.value = service.state;
  });

  onBeforeUnmount(() => {
    service.stop();
  });

  return { state, send: service.send, service };
}

export function useService<TContext, TEvent extends EventObject>(
  service:
    | Interpreter<TContext, any, TEvent>
    | Ref<Interpreter<TContext, any, TEvent>>
): {
  state: Ref<State<TContext, TEvent>>;
  send: Interpreter<TContext, any, TEvent>['send'];
  service: Ref<Interpreter<TContext, any, TEvent>>;
} {
  const serviceRef = isRef(service)
    ? service
    : ref<Interpreter<TContext, any, TEvent>>(service);
  const state = ref<State<TContext, TEvent>>(serviceRef.value.state);

  watch(serviceRef, (watchedService, _, onCleanup) => {
    state.value = watchedService.state;
    const { unsubscribe } = watchedService.subscribe((currentState) => {
      if (currentState.changed) {
        state.value = currentState;
      }
    });
    onCleanup(() => unsubscribe());
  });

  const send = (event: TEvent | TEvent['type']) => serviceRef.value.send(event);

  return { state, send, service: serviceRef };
}
