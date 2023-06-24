import type {
  MachineImplementationsFrom,
  ServiceFrom,
  StateFrom,
  StateMachine
} from '@xstate/fsm';
import { createMachine, interpret } from '@xstate/fsm';
import type { Accessor } from 'solid-js';
import { createMemo, onCleanup, createEffect } from 'solid-js';
import { createImmutable } from './createImmutable.ts';
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

  const setNewState = (currentState: StateFrom<TService>) => {
    setState(deriveFSMState(currentState, unwrap(state)));
  };

  createEffect(() => {
    const currentService = serviceMemo();
    // this eager `setState` here is important because the state could change between render and effect's call
    // however, it might also create some extra work that might not be necessary
    // perhaps we should only do this if the state has changed
    // we'd have to track the "original" state to check if the current one is different from it
    // (for that purpose we can't use the derived one created by `createImmutable` as that's a copy of the original)
    setNewState(currentService.state as StateFrom<TService>);
    const { unsubscribe } = currentService.subscribe(
      setNewState as (state: StateMachine.AnyState) => void
    );
    onCleanup(unsubscribe);
    return false;
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
