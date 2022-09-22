import type {
  MachineImplementationsFrom,
  ServiceFrom,
  StateFrom,
  StateMachine
} from '@xstate/fsm';
import { createMachine, interpret } from '@xstate/fsm';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, on, onCleanup } from 'solid-js';
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

  const getServiceState = () => serviceMemo().state as StateFrom<TService>;

  const [state, setState] = createImmutable(
    deriveFSMState(serviceMemo(), getServiceState())
  );

  // Track if a new service is passed in, only update once per service
  createEffect(
    on(
      serviceMemo,
      () => {
        setState(deriveFSMState(serviceMemo(), getServiceState()));
      },
      { defer: true }
    )
  );

  createEffect(() => {
    const { unsubscribe } = serviceMemo().subscribe((nextState) => {
      setState(deriveFSMState(serviceMemo(), nextState as StateFrom<TService>));
    });
    onCleanup(unsubscribe);
  });

  const send = (event: TService['send']) => serviceMemo().send(event);

  return [state, send, serviceMemo()];
}

function deriveFSMState<
  Service extends StateMachine.AnyService,
  State extends StateFrom<Service>
>(service: Service, state: State): State {
  return {
    ...(state as object),
    matches(...args: Parameters<State['matches']>) {
      // tslint:disable-next-line:no-unused-expression
      (this as StateMachine.AnyState).value as State['value']; // reads state.value to be tracked by the store
      return service.state.matches(args[0] as never);
    }
  } as State;
}
