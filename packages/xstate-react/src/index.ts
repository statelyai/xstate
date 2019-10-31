import { useState, useRef, useEffect } from 'react';
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
   * If `true`, service will start immediately (before mount).
   */
  immediate: boolean;
  /**
   * The state to rehydrate the machine to. The machine will
   * start at this state instead of its `initialState`.
   */
  state?: StateConfig<TContext, TEvent>;
}

const defaultOptions = {
  immediate: false
};

export function useMachine<TContext, TEvent extends EventObject>(
  machine: StateMachine<TContext, any, TEvent>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineOptions<TContext, TEvent>> = defaultOptions
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
    immediate,
    state: rehydratedState,
    ...interpreterOptions
  } = options;

  const machineConfig = {
    context,
    guards,
    actions,
    activities,
    services,
    delays
  };

  // Reference the machine
  const machineRef = useRef<StateMachine<TContext, any, TEvent> | null>(null);

  // Create the machine only once
  // See https://reactjs.org/docs/hooks-faq.html#how-to-create-expensive-objects-lazily
  if (machineRef.current === null) {
    machineRef.current = machine.withConfig(machineConfig, {
      ...machine.context,
      ...context
    } as TContext);
  }

  // Reference the service
  const serviceRef = useRef<Interpreter<TContext, any, TEvent> | null>(null);

  // Create the service only once
  if (serviceRef.current === null) {
    serviceRef.current = interpret(
      machineRef.current,
      interpreterOptions
    ).onTransition(state => {
      // Update the current machine state when a transition occurs
      if (state.changed) {
        setCurrent(state);
      }
    });
  }

  const service = serviceRef.current;

  // Make sure actions and services are kept updated when they change.
  // This mutation assignment is safe because the service instance is only used
  // in one place -- this hook's caller.
  useEffect(() => {
    Object.assign(service.machine.options.actions, actions);
  }, [actions]);

  useEffect(() => {
    Object.assign(service.machine.options.services, services);
  }, [services]);

  // Keep track of the current machine state
  const initialState = rehydratedState
    ? State.create(rehydratedState)
    : service.initialState;

  const [current, setCurrent] = useState(() => initialState);

  // Start service immediately (before mount) if specified in options
  if (immediate) {
    service.start();
  }

  useEffect(() => {
    // Start the service when the component mounts.
    // Note: the service will start only if it hasn't started already.
    //
    // If a rehydrated state was provided, use the resolved `initialState`.
    service.start(rehydratedState ? initialState : undefined);

    return () => {
      // Stop the service when the component unmounts
      service.stop();
    };
  }, []);

  return [current, service.send, service];
}

export function useService<TContext, TEvent extends EventObject>(
  service: Interpreter<TContext, any, TEvent>
): [
  State<TContext, TEvent>,
  Interpreter<TContext, any, TEvent>['send'],
  Interpreter<TContext, any, TEvent>
] {
  const [current, setCurrent] = useState(service.state);

  useEffect(() => {
    // Set to current service state as there is a possibility
    // of a transition occurring between the initial useState()
    // initialization and useEffect() commit.
    setCurrent(service.state);

    const listener = state => {
      if (state.changed) {
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
