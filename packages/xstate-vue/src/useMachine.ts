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

  // Make sure actions and services are kept updated when they change.
  watch(() => {
    Object.assign(service.machine.options.actions, actions);
  });

  watch(() => {
    Object.assign(service.machine.options.services, services);
  });

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
