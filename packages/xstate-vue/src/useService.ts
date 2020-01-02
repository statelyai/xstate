import { ref, Ref, watch, isRef } from '@vue/composition-api';
import { EventObject, State, Interpreter } from 'xstate';

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
