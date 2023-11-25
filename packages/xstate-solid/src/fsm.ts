import type {
  MachineImplementationsFrom,
  ServiceFrom,
  StateFrom,
  StateMachine
} from '@xstate/fsm';
import { createMachine, interpret } from '@xstate/fsm';
import type { Accessor } from 'solid-js';
import { createMemo, onCleanup, createEffect } from 'solid-js';
import { createImmutable } from './createImmutable';
import { isServer } from 'solid-js/web';
import { unwrap } from 'solid-js/store';

type UseFSMServiceReturn<TService extends StateMachine.AnyService> = [
  StateFrom<TService>,
  TService['send']
];

type UseFSMMachineReturn<TService extends StateMachine.AnyService> = [
  ...UseFSMServiceReturn<TService>,
  TService
];

export function useMachine<TMachine extends StateMachine.AnyMachine>(
  machine: TMachine,
  options?: MachineImplementationsFrom<TMachine>
): UseFSMMachineReturn<ServiceFrom<TMachine>> {
  const resolvedMachine = createMachine(
    machine.config,
    options ? options : (machine as any)._options
  );

  const service = interpret(resolvedMachine);

  if (!isServer) {
    service.start();
    onCleanup(() => service.stop());
  }

  const [state, send] = useService(service);
  return [state, send, service] as UseFSMMachineReturn<ServiceFrom<TMachine>>;
}

export function useService<TService extends StateMachine.AnyService>(
  service: TService | Accessor<TService>
): UseFSMServiceReturn<TService> {
  const serviceMemo = createMemo(() =>
    typeof service === 'function' ? service() : service
  );

  const [state, setState] = createImmutable(
    deriveFSMState(serviceMemo().state as StateFrom<TService>)
  );

  createEffect(() => {
    const { unsubscribe } = serviceMemo().subscribe((currentState) =>
      setState(
        deriveFSMState(currentState as StateFrom<TService>, unwrap(state))
      )
    );
    onCleanup(unsubscribe);
  });

  const send: TService['send'] = (event) => serviceMemo().send(event);

  return [state, send];
}

function deriveFSMState<State extends StateMachine.AnyState>(
  state: State,
  prevState?: State
): State {
  return {
    ...state,
    matches:
      prevState && prevState.value === state.value
        ? prevState.matches
        : state.matches
  } as typeof state;
}
