import { createContext, useContext } from 'react';
import { InterpreterFrom, StateFrom, StateMachine } from 'xstate';
import { useActor } from './useActor';
import { useSelector } from './useSelector';

export const createXStateContext = <
  TMachine extends StateMachine<any, any, any, any>
>(
  _machine: TMachine
) => {
  const context = createContext({} as InterpreterFrom<TMachine>);

  const createSelector = <T>(selector: (state: StateFrom<TMachine>) => T) => {
    return selector;
  };

  const useXStateContext = (): InterpreterFrom<TMachine> => {
    const contextValue = useContext(context);

    if (!contextValue) {
      throw new Error(
        'You must use useXStateContext within its XState context provider'
      );
    }

    return contextValue;
  };

  const useXStateActor = () => {
    const service = useXStateContext();

    return useActor(service);
  };

  const useXStateSelector = <T>(
    selector: (state: StateFrom<TMachine>) => T
  ) => {
    const service = useXStateContext();

    return useSelector(service, selector);
  };

  return {
    Provider: context.Provider,
    Consumer: context.Consumer,
    createSelector,
    useContext: useXStateContext,
    useActor: useXStateActor,
    useSelector: useXStateSelector
  };
};
