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
import { deepClone } from './util';

const getServiceState = <TService extends StateMachine.AnyService>(
  service: TService
): StateFrom<TService> => {
  let currentValue: StateFrom<TService>;
  service
    .subscribe((state) => {
      currentValue = state as StateFrom<TService>;
    })
    .unsubscribe();
  return currentValue!;
};

export function useMachine<TMachine extends StateMachine.AnyMachine>(
  machine: TMachine,
  options?: MachineImplementationsFrom<TMachine>
): [StateFrom<TMachine>, ServiceFrom<TMachine>['send'], ServiceFrom<TMachine>] {
  const resolvedMachine = createMachine(
    machine.config,
    options ? options : (machine as any)._options
  );

  const service = interpret(resolvedMachine).start();

  return useService(service) as any;
}

export function useService<TService extends StateMachine.AnyService>(
  service: TService | Accessor<TService>
): [StateFrom<TService>, TService['send'], TService] {
  const serviceMemo = createMemo(() =>
    typeof service === 'function' ? service() : service
  );

  const getClonedState = () => deepClone(getServiceState(serviceMemo()));

  const [state, setState] = createStore<StateFrom<TService>>({
    ...(getClonedState() as object),
    matches(...args: Parameters<StateFrom<TService>['matches']>) {
      // tslint:disable-next-line:no-unused-expression
      (state as StateFrom<any>).value; // sets state.value to be tracked by the store
      return serviceMemo().state.matches(args[0] as never);
    }
  } as StateFrom<TService>);

  const send = (event: TService['send']) => serviceMemo().send(event);

  // Track if a new service is passed in, only update once per service
  createEffect(
    on(
      () => serviceMemo(),
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

  return [state, send, serviceMemo()] as any;
}
