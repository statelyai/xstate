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

  const service = interpret(resolvedMachine).start();

  return useService(service) as UseFSMReturn<ServiceFrom<TMachine>>;
}

export function useService<TService extends StateMachine.AnyService>(
  service: TService | Accessor<TService>
): UseFSMReturn<TService> {
  const serviceMemo = createMemo(() =>
    typeof service === 'function' ? service() : service
  );

  const initialService = serviceMemo();
  const [state, setState] = createImmutable(deriveFSMState(initialService));

  createEffect(() => {
    const currentService = serviceMemo();
    const { unsubscribe } = currentService.subscribe(() =>
      setState(deriveFSMState(currentService))
    );
    onCleanup(unsubscribe);
  });

  const send = (event: TService['send']) => serviceMemo().send(event);

  return [state, send, serviceMemo()];
}

function deriveFSMState<Service extends StateMachine.AnyService>(
  service: Service
): StateFrom<Service> {
  const state = service.state as StateFrom<Service>;
  return {
    ...(state as object),
    matches(...args: Parameters<typeof state['matches']>) {
      // tslint:disable-next-line:no-unused-expression
      (this as StateMachine.AnyState).value as typeof state['value']; // reads state.value to be tracked by the store
      return service.state.matches(args[0] as never);
    }
  } as typeof state;
}
