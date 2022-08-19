import type {
  EventObject,
  MachineImplementationsFrom,
  StateMachine,
  StateFrom,
  ServiceFrom,
  Typestate
} from '@xstate/fsm';
import { interpret, createMachine } from '@xstate/fsm';

import { createStore, reconcile } from 'solid-js/store';
import type { Accessor } from 'solid-js';

import {
  $PROXY,
  batch,
  createEffect,
  createMemo,
  on,
  onCleanup,
  onMount
} from 'solid-js';

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
        setState(reconcile(nextState as StateFrom<TMachine>));
      });
    });

    onCleanup(service.stop);
  });

  return [state, send, service] as any;
}

export function useService<TService extends StateMachine.AnyService>(
  service: TService | Accessor<TService>
): TService {
  const serviceMemo = createMemo(() =>
    typeof service === 'function' ? service() : service
  );
  const [state, setState] = createStore(getServiceState(serviceMemo()));

  const send = (event: TService['send']) => serviceMemo().send(event);

  createEffect(
    on(serviceMemo, (_, prev) => {
      if (prev) {
        checkReusedService(getServiceState(serviceMemo()));
      }
      const { unsubscribe } = serviceMemo().subscribe((nextState) => {
        setState(reconcile<typeof nextState, typeof nextState>(nextState));
      });
      onCleanup(unsubscribe);
    })
  );

  return [state, send, serviceMemo()] as any;
}

function checkReusedService(serviceState: StateMachine.State<any, any, any>) {
  // Check if the machine has already been used as a service
  // When FSM services re-use a single machine they share a reference to the same
  // machine state object, causing updates to propagate to all services when used
  // with Solid's store
  if ($PROXY in serviceState) {
    // tslint:disable-next-line:no-console
    console.warn(
      'Reusing an FSM machine will cause unexpected state changes in @xstate/solid.\n' +
        'Use a factory function to reuse a machine: `const newMachine = () => createMachine(...some machine config)`'
    );
  }
}
