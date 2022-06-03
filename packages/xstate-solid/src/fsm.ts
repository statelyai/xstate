import type { EventObject, StateMachine, Typestate } from '@xstate/fsm';
import { interpret, createMachine } from '@xstate/fsm';

import { createStore, reconcile } from 'solid-js/store';
import type { Accessor } from 'solid-js';

import { batch, createEffect, on, onCleanup, onMount } from 'solid-js';
import { deepClone, updateState } from './utils';

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

export function useMachine<
  TContext extends object,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext>
>(
  machine: StateMachine.Machine<TContext, TEvent, TTypestate>,
  options?: {
    actions?: StateMachine.ActionMap<TContext, TEvent>;
  }
): [
  StateMachine.State<TContext, TEvent, TTypestate>,
  (event: TEvent | TEvent['type']) => void,
  StateMachine.Service<TContext, TEvent, TTypestate>
] {
  const resolvedMachine = createMachine(
    machine.config,
    options ? options : (machine as any)._options
  );

  const service = interpret(resolvedMachine).start();
  const send = (event: TEvent | TEvent['type']) => service.send(event);

  const [state, setState] = createStore<
    StateMachine.State<TContext, TEvent, TTypestate>
  >({
    ...service.state,
    matches<TSV extends TTypestate['value']>(value: TSV) {
      // tslint:disable-next-line:no-unused-expression
      state.value; // sets state.value to be tracked by the store
      return service.state.matches(value);
    }
  });

  onMount(() => {
    service.subscribe((nextState) => {
      batch(() => {
        updateState(nextState, setState);
      });
    });

    onCleanup(service.stop);
  });

  return [
    (state as unknown) as StateMachine.State<TContext, TEvent, TTypestate>,
    send,
    service
  ];
}

export function useService<
  TContext extends object,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = { value: any; context: TContext }
>(
  service: Accessor<StateMachine.Service<TContext, TEvent, TState>>
): [
  StateMachine.State<TContext, TEvent, TState>,
  StateMachine.Service<TContext, TEvent, TState>['send'],
  StateMachine.Service<TContext, TEvent, TState>
] {
  // Clone object to avoid mutation of services using the same machine
  const [state, setState] = createStore(deepClone(getServiceState(service())));

  const send = (event: TEvent | TEvent['type']) => service().send(event);

  createEffect(
    on(service, () => {
      const { unsubscribe } = service().subscribe((nextState) => {
        setState(reconcile<typeof nextState, unknown>(nextState));
      });
      onCleanup(unsubscribe);
    })
  );

  return [
    (state as unknown) as StateMachine.State<TContext, TEvent, TState>,
    send,
    service()
  ];
}
