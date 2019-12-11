import { ref, onBeforeMount, onBeforeUnmount, Ref } from '@vue/composition-api';
import { StateMachine, EventObject, interpret } from '@xstate/fsm';
import { AnyEventObject } from 'xstate';

export function useFsm<TC, TE extends EventObject = AnyEventObject>(
  stateMachine: StateMachine.Machine<TC, TE, any>
): {
  state: Ref<StateMachine.State<TC, TE, any>>;
  send: StateMachine.Service<TC, TE>['send'];
  service: Ref<StateMachine.Service<TC, TE>>;
} {
  const state = ref<StateMachine.State<TC, TE, any>>(stateMachine.initialState);
  const service = ref<StateMachine.Service<TC, TE>>(interpret(stateMachine));
  const send = (event: TE | TE['type']) => service.value.send(event);

  onBeforeMount(() => {
    service.value.subscribe(s => (state.value = s));
    service.value.start();
  });

  onBeforeUnmount(() => {
    service.value.stop();
  });

  return { state, send, service };
}
