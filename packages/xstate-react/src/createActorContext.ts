import * as React from 'react';
import { useActorRef } from './useActorRef';
import { useSelector as useSelectorUnbound } from './useSelector';
import {
  ActorRefFrom,
  AnyStateMachine,
  SnapshotFrom,
  InterpreterOptions,
  Observer,
  StateFrom,
  AreAllImplementationsAssumedToBeProvided,
  MarkAllImplementationsAsProvided,
  StateMachine
} from 'xstate';

type ToMachinesWithProvidedImplementations<TMachine extends AnyStateMachine> =
  TMachine extends StateMachine<
    infer TContext,
    infer TEvent,
    infer TAction,
    infer TActorMap,
    infer TResolvedTypesMeta
  >
    ? StateMachine<
        TContext,
        TEvent,
        TAction,
        TActorMap,
        AreAllImplementationsAssumedToBeProvided<TResolvedTypesMeta> extends false
          ? MarkAllImplementationsAsProvided<TResolvedTypesMeta>
          : TResolvedTypesMeta
      >
    : never;

export function createActorContext<TMachine extends AnyStateMachine>(
  machine: TMachine,
  interpreterOptions?: InterpreterOptions<TMachine>,
  observerOrListener?:
    | Observer<StateFrom<TMachine>>
    | ((value: StateFrom<TMachine>) => void)
): {
  useSelector: <T>(
    selector: (snapshot: SnapshotFrom<TMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ) => T;
  useActorRef: () => ActorRefFrom<TMachine>;
  Provider: (
    props: {
      children: React.ReactNode;
    } & (AreAllImplementationsAssumedToBeProvided<
      TMachine['__TResolvedTypesMeta']
    > extends true
      ? {
          machine?: TMachine;
        }
      : {
          machine: ToMachinesWithProvidedImplementations<TMachine>;
        })
  ) => React.ReactElement<any, any>;
} {
  const ReactContext = React.createContext<ActorRefFrom<TMachine> | null>(null);

  const OriginalProvider = ReactContext.Provider;

  function Provider({
    children,
    machine: providedMachine = machine
  }: {
    children: React.ReactNode;
    machine: TMachine;
  }) {
    const actor = (useActorRef as any)(
      providedMachine,
      interpreterOptions,
      observerOrListener
    ) as ActorRefFrom<TMachine>;

    return React.createElement(OriginalProvider, {
      value: actor,
      children
    });
  }

  Provider.displayName = `ActorProvider(${machine.id})`;

  function useContext(): ActorRefFrom<TMachine> {
    const actor = React.useContext(ReactContext);

    if (!actor) {
      throw new Error(
        `You used a hook from "${Provider.displayName}" but it's not inside a <${Provider.displayName}> component.`
      );
    }

    return actor;
  }

  function useSelector<T>(
    selector: (snapshot: SnapshotFrom<TMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ): T {
    const actor = useContext();
    return useSelectorUnbound(actor, selector, compare);
  }

  return {
    Provider: Provider as any,
    useActorRef: useContext,
    useSelector
  };
}
