import { useState, useEffect, useRef } from 'react';
import {
  interpret,
  EventObject,
  StateMachine,
  State,
  Interpreter,
  InterpreterOptions,
  MachineOptions,
  Typestate,
  StateConfig
} from 'xstate';
import useConstant from './useConstant';

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

export function useMachine<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = any
>(
  machine: StateMachine<TContext, any, TEvent, TTypestate>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineOptions<TContext, TEvent>> = {}
): [
  State<TContext, TEvent, any, TTypestate>,
  Interpreter<TContext, any, TEvent, TTypestate>['send'],
  Interpreter<TContext, any, TEvent, TTypestate>
] {
  if (process.env.NODE_ENV !== 'production') {
    const [initialMachine] = useState(machine);
    if (machine !== initialMachine) {
      console.warn(
        'Machine given to `useMachine` has changed between renders. This is not supported and might lead to unexpected results.\n' +
          'Please make sure that you pass the same Machine as argument each time.'
      );
    }
  }

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

  // Keep a single reference to the invoked machine (the service)
  const service = useConstant(() => {
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

    // Ensure that actions are not executed (until useEffect() below)
    interpreterOptions.execute = false;

    return interpret(createdMachine, interpreterOptions).start(
      rehydratedState ? State.create(rehydratedState) : undefined
    );
  });

  // Initialize the state with the initial state.
  const [state, setState] = useState(service.state);

  // Capture all actions (side-effects) to be executed.
  // These will be flushed when they are executed, and avoids the issue of batched events
  // sent to the interpreter, which might ignore actions.
  const actionStatesRef = useRef<Array<State<TContext, TEvent>>>([state]);

  // Make sure actions and services are kept updated when they change.
  // This mutation assignment is safe because the service instance is only used
  // in one place -- this hook's caller.
  useEffect(() => {
    Object.assign(service.machine.options.actions, actions);
  }, [actions]);
  useEffect(() => {
    Object.assign(service.machine.options.services, services);
  }, [services]);

  useEffect(() => {
    // Whenever a new state is emitted from the service,
    // update the state with that state, but only if
    // that state has changed.
    service.onTransition((currentState) => {
      if (currentState.changed) {
        // capture side-effects to be executed
        actionStatesRef.current.push(currentState);

        // change state
        setState(currentState);
      }
    });

    return () => {
      service.stop();
    };
  }, []);

  useEffect(() => {
    // Flush all actions to be executed (per state)
    actionStatesRef.current.forEach((actionState) => {
      // Execute all actions for the captured state
      service.execute(actionState);
    });

    actionStatesRef.current = [];
  }, [state]);

  return [state, service.send, service];
}
