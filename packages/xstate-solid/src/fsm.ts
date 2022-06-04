import type { EventObject, StateMachine, Typestate } from '@xstate/fsm';
import {
  interpret,
  createMachine,
  MachineImplementationsFrom,
  StateFrom,
  ServiceFrom
} from '@xstate/fsm';

import { createStore, reconcile } from 'solid-js/store';
import type { Accessor } from 'solid-js';

import { batch, createEffect, on, onCleanup, onMount } from 'solid-js';
import { updateState } from './updateState';

const getServiceState = <
  TContext extends object,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = { value: any; context: TContext }
>(
  service: StateMachine.Service<TContext, TEvent, TState>
): StateMachine.State<TContext, TEvent, TState> => {
  let currentValue: StateMachine.State<TContext, TEvent, TState>;
  service
    .subscribe((state) => {
      currentValue = state;
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
  const send = (event: ServiceFrom<TMachine>['send']) => service.send(event);

  const [state, setState] = createStore<StateFrom<TMachine>>({
    ...service.state,
    matches(...args: Parameters<StateFrom<TMachine>['matches']>) {
      // tslint:disable-next-line:no-unused-expression
      (state as StateFrom<StateMachine.AnyMachine>).value; // sets state.value to be tracked by the store
      return service.state.matches(args[0] as never);
    }
  } as StateFrom<TMachine>);

  onMount(() => {
    service.subscribe((nextState) => {
      batch(() => {
        updateState(nextState as StateFrom<TMachine>, setState);
      });
    });

    onCleanup(service.stop);
  });

  return [state, send, service] as any;
}

export function useService<TService extends StateMachine.AnyService>(
  service: Accessor<TService>
): [StateFrom<TService>, TService['send'], TService] {
  // Lazy clone object to avoid mutation of services using the same machine
  const [state, setState] = createStore(
    JSON.parse(JSON.stringify(getServiceState(service())))
  );

  const send = (event: TService['send']) => service().send(event);

  createEffect(
    on(service, () => {
      const { unsubscribe } = service().subscribe((nextState) => {
        setState(reconcile<typeof nextState, typeof nextState>(nextState));
      });
      onCleanup(unsubscribe);
    })
  );

  return [state, send, service()] as any;
}
