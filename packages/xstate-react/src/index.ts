import { useState, useRef, useEffect } from 'react';
import {
  interpret,
  EventObject,
  StateMachine,
  State,
  Interpreter
} from 'xstate';

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
): [
  State<TContext, TEvent>,
  Interpreter<TContext, any, TEvent>['send'],
  Interpreter<TContext, any, TEvent>
] {
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
    });
  }

  // Keep track of the current machine state
  const [current, setCurrent] = useState(serviceRef.current.initialState);

  const service = serviceRef.current;

  useEffect(() => {
    // Start the service when the component mounts
    service.start();

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
    const listener = state => {
      if (state.changed) {
        setCurrent(state);
      }
    };

    service.onTransition(listener);

    return () => {
      service.off(listener);
    };
  }, []);

  return [current, service.send, service];
}
