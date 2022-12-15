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

type UseFSMReturn<TService extends StateMachine.AnyService> = [
  StateFrom<TService>,
  TService['send'],
  TService
];

export function useMachine<TMachine extends StateMachine.AnyMachine>(
  machine: TMachine,
  options?: MachineImplementationsFrom<TMachine>
): UseFSMReturn<ServiceFrom<TMachine>> {
  const resolvedMachine = createMachine(
    machine.config,
    options ? options : (machine as any)._options
  );

  const service = interpret(resolvedMachine);

  if (!isServer) {
    service.start();
    onCleanup(() => service.stop());
  }

  return useService(service) as UseFSMReturn<ServiceFrom<TMachine>>;
}

export function useService<TService extends StateMachine.AnyService>(
  service: TService | Accessor<TService>
): UseFSMReturn<TService> {
  const serviceMemo = createMemo(() =>
    typeof service === 'function' ? service() : service
  );

  const initialService = serviceMemo();
  const [state, setState] = createImmutable(
    deriveFSMState(initialService.state as StateFrom<TService>)
  );

  createEffect(() => {
    const currentService = serviceMemo();
    const { unsubscribe } = currentService.subscribe(() =>
      setState(deriveFSMState(currentService.state as StateFrom<TService>))
    );
    onCleanup(unsubscribe);
  });

  const send = (event: TService['send']) => serviceMemo().send(event);

  return [state, send, serviceMemo()];
}

function deriveFSMState<State extends StateMachine.AnyState>(
  state: State
): State {
  return {
    ...(state as object),
    matches(...args: Parameters<typeof state['matches']>) {
      // tslint:disable-next-line:no-unused-expression
      (this as StateMachine.AnyState).value as typeof state['value']; // reads state.value to be tracked by the store
      return state.matches(args[0] as never);
    }
  } as typeof state;
}
