import { useState, useRef, useEffect } from 'react';
import { interpret, EventObject, StateMachine, State } from 'xstate';
import { Interpreter } from 'xstate/lib/interpreter';

interface InterpreterOptions {
  /**
   * Whether state actions should be executed immediately upon transition. Defaults to `true`.
   */
  execute: boolean;
  logger: (...args: any[]) => void;
  /**
   * If `true`, defers processing of sent events until the service
   * is initialized (`.start()`). Otherwise, an error will be thrown
   * for events sent to an uninitialized service.
   *
   * Default: `true`
   */
  deferEvents: boolean;
  /**
   * If `true`, states and events will be logged to Redux DevTools.
   *
   * Default: `false`
   */
  devTools: boolean;
}

export function useMachine<TContext, TEvent extends EventObject>(
  machine: StateMachine<TContext, any, TEvent>,
  options?: Partial<InterpreterOptions>
): [State<TContext, TEvent>, Interpreter<TContext, any, TEvent>['send']] {
  // Keep track of the current machine state
  const [current, setCurrent] = useState(machine.initialState);

  // Start the service (only once!)
  const service = useRef(
    interpret(machine, options).onTransition(state => {
      // Update the current machine state when a transition occurs
      if (state.changed) {
        setCurrent(state);
      }
    }),
    []
  );

  // Stop the service when the component unmounts
  useEffect(() => {
    service.start();

    return () => {
      service.stop();
    };
  }, []);

  return [current, service.send];
}
