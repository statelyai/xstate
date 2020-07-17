import {
  shallowRef,
  isRef,
  watch,
  onMounted,
  onBeforeUnmount,
  Ref
} from '@vue/composition-api';
import {
  createMachine,
  interpret,
  StateMachine,
  EventObject,
  Typestate
} from '@xstate/fsm';

const getServiceValue = <
  TContext extends object,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = { value: any; context: TContext }
>(
  service: StateMachine.Service<TContext, TEvent, TState>
): StateMachine.State<TContext, TEvent, TState> => {
  let currentValue: StateMachine.State<TContext, TEvent, TState>;
  service
    .subscribe((state) => {
      currentValue = state;
    })
    .unsubscribe();
  return currentValue!;
};

export function useMachine<
  TContext extends object,
  TEvent extends EventObject = EventObject
>(
  stateMachine: StateMachine.Machine<TContext, TEvent, any>,
  options?: {
    actions?: StateMachine.ActionMap<TContext, TEvent>;
  }
): {
  state: Ref<StateMachine.State<TContext, TEvent, any>>;
  send: StateMachine.Service<TContext, TEvent>['send'];
  service: StateMachine.Service<TContext, TEvent>;
} {
  const service = interpret(
    createMachine(
      stateMachine.config,
      options ? options : (stateMachine as any)._options
    )
  ).start();

  const state = shallowRef<StateMachine.State<TContext, TEvent, any>>(
    getServiceValue(service)
  );

  onMounted(() => {
    service.subscribe((currentState) => (state.value = currentState));
  });

  onBeforeUnmount(service.stop);

  return { state, send: service.send, service };
}

export function useService<
  TContext extends object,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = { value: any; context: TContext }
>(
  service:
    | StateMachine.Service<TContext, TEvent, TState>
    | Ref<StateMachine.Service<TContext, TEvent, TState>>
): {
  state: Ref<StateMachine.State<TContext, TEvent, TState>>;
  send: StateMachine.Service<TContext, TEvent, TState>['send'];
  service: Ref<StateMachine.Service<TContext, TEvent, TState>>;
} {
  const serviceRef: Ref<StateMachine.Service<TContext, TEvent, TState>> = isRef(
    service
  )
    ? service
    : shallowRef(service);
  const state = shallowRef<StateMachine.State<TContext, TEvent, TState>>(
    serviceRef.value.state
  );

  watch(
    serviceRef,
    (service, _, onCleanup) => {
      state.value = getServiceValue(service);

      const { unsubscribe } = service.subscribe((currentState) => {
        if (currentState.changed) {
          state.value = currentState;
        }
      });
      onCleanup(unsubscribe);
    },
    {
      immediate: true
    }
  );

  const send = (event: TEvent | TEvent['type']) => serviceRef.value.send(event);

  return { state, send, service: serviceRef };
}
