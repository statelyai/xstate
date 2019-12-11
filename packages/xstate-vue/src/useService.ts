import { ref, Ref, onBeforeUnmount } from '@vue/composition-api';
import { EventObject, State, Interpreter } from 'xstate';

export function useService<TContext, TEvent extends EventObject>(
  service: Interpreter<TContext, any, TEvent>
): {
  current: Ref<State<TContext, TEvent>>;
  send: Interpreter<TContext, any, TEvent>['send'];
  service: Ref<Interpreter<TContext, any, TEvent>>;
} {
  const current = ref<State<TContext, TEvent>>(service.state);
  const serviceRef = ref<Interpreter<TContext, any, TEvent>>(service);

  const { unsubscribe } = serviceRef.value.subscribe(state => {
    if (state.changed) {
      current.value = state;
    }
  });

  const send = (event: TEvent | TEvent['type']) => serviceRef.value.send(event);

  onBeforeUnmount(() => {
    unsubscribe();
  });

  return {
    current,
    send,
    service: serviceRef
  };
}
