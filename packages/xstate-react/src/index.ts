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

  // Reference the service
  const serviceRef = useRef<Interpreter<TContext, any, TEvent> | null>(null);

  // Create the service only once
  // See https://reactjs.org/docs/hooks-faq.html#how-to-create-expensive-objects-lazily
  if (serviceRef.current === null) {
    serviceRef.current = interpret(machine, options).onTransition(state => {
      // Update the current machine state when a transition occurs
      if (state.changed) {
        setCurrent(state);
      }
    })
  }

  const service = serviceRef.current;

  useEffect(() => {
    // Start the service when the component mounts
    service.start();

    return () => {
      // Stop the service when the component unmounts
      service.stop();
    };
  }, []);

  return [current, service.send];
}
