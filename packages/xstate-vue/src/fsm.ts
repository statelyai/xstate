import { ref, onBeforeUnmount, Ref } from '@vue/composition-api';
import { StateMachine, EventObject, interpret } from '@xstate/fsm';
import { AnyEventObject } from 'xstate';

export function useMachine<TC, TE extends EventObject = AnyEventObject>(
  stateMachine: StateMachine.Machine<TC, TE, any>
): {
  state: Ref<StateMachine.State<TC, TE, any>>;
  send: StateMachine.Service<TC, TE>['send'];
  service: StateMachine.Service<TC, TE>;
} {
  const state = ref<StateMachine.State<TC, TE, any>>(stateMachine.initialState);
  const service = interpret(stateMachine);
  const send = (event: TE | TE['type']) => service.send(event);

  service.subscribe(s => (state.value = s));
  service.start();

  onBeforeUnmount(() => {
    service.stop();
  });

  return { state, send, service };
}
