import {
  ref,
  Ref,
  watch,
  onBeforeMount,
  onBeforeUnmount
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

const defaultOptions = {
  immediate: false
};

export function useMachine<TContext, TEvent extends EventObject>(
  machine: StateMachine<TContext, any, TEvent>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineOptions<TContext, TEvent>> = defaultOptions
): {
  current: Ref<State<TContext, TEvent>>;
  send: Interpreter<TContext, any, TEvent>['send'];
  service: Ref<Interpreter<TContext, any, TEvent>>;
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

  const machineRef = ref<StateMachine<TContext, any, TEvent>>(
    machine.withConfig(machineConfig, {
      ...machine.context,
      ...context
    } as TContext)
  );

  const service = ref<Interpreter<TContext, any, TEvent>>(
    interpret(machineRef.value, interpreterOptions).onTransition(state => {
      if (state.changed) {
        current.value = state;
      }
    })
  );

  const initialState = rehydratedState
    ? State.create(rehydratedState)
    : service.value.initialState;

  const current = ref<State<TContext, TEvent>>(initialState);

  // Make sure actions and services are kept updated when they change.
  watch(() => {
    Object.assign(service.value.machine.options.actions, actions);
  });

  watch(() => {
    Object.assign(service.value.machine.options.services, services);
  });

  // extract send method for sending events to the service
  const send = (event: TEvent | TEvent['type']) => service.value.send(event);

  onBeforeMount(() => {
    service.value.start(rehydratedState ? initialState : undefined);
  });

  onBeforeUnmount(() => {
    service.value.stop();
  });

  return {
    current,
    service,
    send
  };
}
