import { shallowRef, watch, isRef, onMounted, onBeforeUnmount, Ref } from 'vue';
import {
  interpret,
  EventObject,
  StateMachine,
  State,
  Interpreter,
  InterpreterOptions,
  MachineOptions,
  StateConfig,
  Typestate
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

export function useMachine<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  machine: StateMachine<TContext, any, TEvent, TTypestate>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineOptions<TContext, TEvent>> = {}
): {
  state: Ref<State<TContext, TEvent, any, TTypestate>>;
  send: Interpreter<TContext, any, TEvent, TTypestate>['send'];
  service: Interpreter<TContext, any, TEvent, TTypestate>;
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

  const createdMachine = machine.withConfig(machineConfig, {
    ...machine.context,
    ...context
  } as TContext);

  const service = interpret(createdMachine, interpreterOptions).start(
    rehydratedState
      ? (State.create(rehydratedState) as State<
          TContext,
          TEvent,
          any,
          TTypestate
        >)
      : undefined
  );

  const state = shallowRef(service.state);

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

export function useService<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  service:
    | Interpreter<TContext, any, TEvent, TTypestate>
    | Ref<Interpreter<TContext, any, TEvent, TTypestate>>
): {
  state: Ref<State<TContext, TEvent, any, TTypestate>>;
  send: Interpreter<TContext, any, TEvent, TTypestate>['send'];
  service: Ref<Interpreter<TContext, any, TEvent, TTypestate>>;
} {
  const serviceRef = isRef(service) ? service : shallowRef(service);
  const state = shallowRef(serviceRef.value.state);

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
