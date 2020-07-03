import {
  shallowRef,
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
  machine: MachineNode<TContext, TEvent>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineOptions<TContext, TEvent>> = {}
): {
  state: Ref<State<TContext, TEvent>>;
  send: Interpreter<TContext, TEvent>['send'];
  service: Interpreter<TContext, TEvent>;
} {
  const {
    context,
    guards,
    actions,
    activities,
    behaviors,
    delays,
    state: rehydratedState,
    ...interpreterOptions
  } = options;

  const machineConfig = {
    context,
    guards,
    actions,
    activities,
    behaviors,
    delays
  };

  const createdMachine = machine.withConfig({
    ...machineConfig,
    context
  });

  const service = interpret(createdMachine, interpreterOptions).start(
    rehydratedState ? State.create(rehydratedState) : undefined
  );

  const state = shallowRef<State<TContext, TEvent>>(service.state);

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
  service: Interpreter<TContext, TEvent> | Ref<Interpreter<TContext, TEvent>>
): {
  state: Ref<State<TContext, TEvent>>;
  send: Interpreter<TContext, TEvent>['send'];
  service: Ref<Interpreter<TContext, TEvent>>;
} {
  const serviceRef = isRef(service)
    ? service
    : shallowRef<Interpreter<TContext, TEvent>>(service);
  const state = shallowRef<State<TContext, TEvent>>(serviceRef.value.state);

  watch(
    serviceRef,
    (service, _, onCleanup) => {
      state.value = service.state;
      const { unsubscribe } = service.subscribe((currentState) => {
        if (currentState.changed) {
          state.value = currentState;
        }
      });
      onCleanup(() => unsubscribe());
    },
    {
      immediate: true
    }
  );

  const send = (event: TEvent | TEvent['type']) => serviceRef.value.send(event);

  return { state, send, service: serviceRef };
}
