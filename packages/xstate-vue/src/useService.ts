import { shallowRef, watch, isRef, Ref } from 'vue';
import { EventObject, State, Interpreter, Typestate } from 'xstate';

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
