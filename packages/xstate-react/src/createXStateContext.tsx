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

export function createXStateContext<
  TMachine extends StateMachine<any, any, any, any>
>(machine: TMachine, machineName?: string) {
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

  return {
    // TODO - bikeshed name
    MachineProvider: (props: {
      options?: TMachine extends StateMachine<
        infer TContext,
        infer _,
        infer TEvent
      >
        ? Partial<MachineOptions<TContext, TEvent>>
        : never;
      children?: React.ReactNode;
    }) => {
      const service = useInterpret(machine, props.options) as any;

      return (
        <context.Provider value={service}>{props.children}</context.Provider>
      );
    },
    Provider: context.Provider,
    Consumer: context.Consumer,
    createSelector,
    useContext: useXStateContext,
    useActor: useXStateActor,
    useSelector: useXStateSelector
  };
}
