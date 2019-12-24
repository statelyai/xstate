import { useState, useEffect } from 'react';
import {
  interpret,
  EventObject,
  StateMachine,
  State,
  Interpreter,
  InterpreterOptions,
  MachineOptions,
  StateConfig
} from 'xstate';
interface UseMachineOptions<TContext, TEvent extends EventObject> {
  /**
   * If provided, will be merged with machine's `context`.
   */
  context?: Partial<TContext>;
  /**
   * The state to rehydrate the machine to. The machine will
   * start at this state instead of its `initialState`.
   */
  state?: StateConfig<TContext, TEvent>;
}

export function useMachine<TContext, TEvent extends EventObject>(
  machine: StateMachine<TContext, any, TEvent>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineOptions<TContext, TEvent>> = {}
): [
  State<TContext, TEvent>,
  Interpreter<TContext, any, TEvent>['send'],
  Interpreter<TContext, any, TEvent>
] {
  const {
    context,
    guards,
    actions,
    activities,
    services,
    delays,
    state: rehydratedState,
    ...interpreterOptions
  } = options;

  const createCachedInstances = (): {
    inputMachine: StateMachine<TContext, any, TEvent>;
    service: Interpreter<TContext, any, TEvent>;
    state: State<TContext, TEvent>;
  } => {
    const machineConfig = {
      context,
      guards,
      actions,
      activities,
      services,
      delays
    };

    const createdMachine = machine.withConfig(machineConfig, {
      ...machine.context,
      ...context
    } as TContext);

    const service = interpret(createdMachine, interpreterOptions).start(
      rehydratedState ? State.create(rehydratedState) : undefined
    );

    return {
      inputMachine: machine,
      service,
      state: service.state
    };
  };

  // Reference the machine
  const [cachedInstances, setCachedInstances] = useState(createCachedInstances);

  if (cachedInstances.inputMachine !== machine) {
    setCachedInstances(createCachedInstances);
  }

  useEffect(() => {
    const currentService = cachedInstances.service;

    currentService.onTransition(state => {
      if (state.changed) {
        setCachedInstances(previous => ({ ...previous, state }));
      }
    });

    if (cachedInstances.state !== currentService.state) {
      setCachedInstances(previous => ({
        ...previous,
        state: currentService.state
      }));
    }
    return () => {
      currentService.stop();
    };
  }, [cachedInstances.service]);

  const { service, state } = cachedInstances;

  // Make sure actions and services are kept updated when they change.
  // This mutation assignment is safe because the service instance is only used
  // in one place -- this hook's caller.
  useEffect(() => {
    Object.assign(service.machine.options.actions, actions);
  }, [actions]);

  useEffect(() => {
    Object.assign(service.machine.options.services, services);
  }, [services]);

  return [state, service.send, service];
}

export function useService<TContext, TEvent extends EventObject>(
  service: Interpreter<TContext, any, TEvent>
): [
  State<TContext, TEvent>,
  Interpreter<TContext, any, TEvent>['send'],
  Interpreter<TContext, any, TEvent>
] {
  const [current, setCurrent] = useState(service.state || service.initialState);

  useEffect(() => {
    // Set to current service state as there is a possibility
    // of a transition occurring between the initial useState()
    // initialization and useEffect() commit.
    setCurrent(service.state || service.initialState);

    const listener = state => {
      if (state.changed !== false) {
        setCurrent(state);
      }
    };

    const sub = service.subscribe(listener);

    return () => {
      sub.unsubscribe();
    };
  }, [service]);

  return [current, service.send, service];
}

export { useActor } from './useActor';
