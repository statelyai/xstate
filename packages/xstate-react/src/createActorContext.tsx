import React, { createContext, useContext } from 'react';
import {
  InterpreterFrom,
  MachineOptions,
  StateFrom,
  StateMachine
} from 'xstate';
import { useActor } from './useActor';
import { useInterpret } from './useInterpret';
import { useSelector } from './useSelector';

/**
 * Provides a toolkit for using XState with global
 * state in React.
 */
export function createActorContext<
  TMachine extends StateMachine<any, any, any, any>
>(
  machine: TMachine,
  /**
   * An optional display name used for debugging,
   * error messages and better presentation in
   * React DevTools
   */
  machineName?: string
) {
  const context = createContext({} as InterpreterFrom<TMachine>);

  const resolvedDisplayName = `${machineName || machine.id}Provider`;

  context.displayName = resolvedDisplayName;

  function createSelector<T>(selector: (state: StateFrom<TMachine>) => T) {
    return selector;
  }

  const useXStateContext = (): InterpreterFrom<TMachine> => {
    const contextValue = useContext(context);

    if (!contextValue) {
      throw new Error(
        `You must use useXStateContext within ${resolvedDisplayName}`
      );
    }

    return contextValue;
  };

  const useXStateActor = () => {
    const service = useXStateContext();

    return useActor(service);
  };

  function useXStateSelector<T>(selector: (state: StateFrom<TMachine>) => T) {
    const service = useXStateContext();

    return useSelector(service, selector);
  }

  const Provider: React.FC<{
    options?: TMachine extends StateMachine<
      infer TContext,
      infer _,
      infer TEvent
    >
      ? Partial<MachineOptions<TContext, TEvent>>
      : never;
  }> = (props) => {
    const service = useInterpret(machine, props.options) as any;

    return (
      <context.Provider value={service}>{props.children}</context.Provider>
    );
  };

  Provider.displayName = resolvedDisplayName;

  return {
    /**
     * The root-level provider you should wrap
     * your application with to gain access
     * to the service.
     *
     * @example
     *
     * const { Provider } = createActorContext(machine);
     *
     * const App = () => {
         return (
           <Provider
             options={{
               actions: {
                 sayHello: () => {
                   console.log('Hello');
                 }
               }
             }}
           >
             <MyComponent />
           </Provider>
         );
       };
     */
    Provider,
    /**
     * The context created by React - useful
     * if you want to access `context.Provider`
     * or `context.Consumer`
     */
    context,
    /**
     * Creates a typed selector which can be
     * passed into useSelector
     *
     * @example
     *
     * const getIsToggledOn = toggleContext.createSelector(
     *   state => state.matches('toggledOn')
     * );
     */
    createSelector,
    /**
     * Returns the running service - useful if you
     * want to send it events:
     *
     * @example
     *
     * const service = toggleContext.useContext();
     * service.send('TOGGLE');
     */
    useContext: useXStateContext,
    /**
     * Returns `[state, send]` in a tuple, like
     * useActor
     *
     * @example
     *
     * const [state, send] = toggleContext.useActor();
     */
    useActor: useXStateActor,
    /**
     * Allows for passing in a selector function to
     * the running service.
     *
     * @example
     *
     * const isToggledOn = toggleContext.useSelector(
     *   state => state.matches('toggledOn')
     * );
     */
    useSelector: useXStateSelector
  };
}
