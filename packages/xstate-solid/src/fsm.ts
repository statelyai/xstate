import type {
  MachineImplementationsFrom,
  ServiceFrom,
  StateFrom,
  StateMachine
} from '@xstate/fsm';
import { createMachine, interpret } from '@xstate/fsm';

import { createStore, reconcile } from 'solid-js/store';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, on, onCleanup } from 'solid-js';
import { deepClone } from './utils';

type UseFSMReturnTuple<TService extends StateMachine.AnyService> = [
  StateFrom<TService>,
  TService['send'],
  TService
];
export function useMachine<TMachine extends StateMachine.AnyMachine>(
  machine: TMachine,
  options?: MachineImplementationsFrom<TMachine>
): UseFSMReturnTuple<ServiceFrom<TMachine>> {
  const resolvedMachine = createMachine(
    machine.config,
    options ? options : (machine as any)._options
  );

  const service = interpret(resolvedMachine).start();

  return useService(service) as UseFSMReturnTuple<ServiceFrom<TMachine>>;
}

export function useService<TService extends StateMachine.AnyService>(
  service: TService | Accessor<TService>
): UseFSMReturnTuple<TService> {
  const serviceMemo = createMemo(() =>
    typeof service === 'function' ? service() : service
  );

  const getClonedState = () =>
    deepClone(serviceMemo().state) as StateFrom<TService>;

  const [state, setState] = createStore<StateFrom<TService>>({
    ...(getClonedState() as object),
    matches(...args: Parameters<StateFrom<TService>['matches']>) {
      // tslint:disable-next-line:no-unused-expression
      (state as StateFrom<any>).value; // sets state.value to be tracked by the store
      return serviceMemo().state.matches(args[0] as never);
    }
  } as StateFrom<TService>);

  // Track if a new service is passed in, only update once per service
  createEffect(
    on(
      serviceMemo,
      () => {
        setState(getClonedState());
      },
      { defer: true }
    )
  );

  createEffect(() => {
    const { unsubscribe } = serviceMemo().subscribe((nextState) => {
      setState(reconcile(nextState as StateFrom<TService>));
    });
    onCleanup(unsubscribe);
  });

  const send = (event: TService['send']) => serviceMemo().send(event);

  return [state, send, serviceMemo()];
}
