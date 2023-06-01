import * as React from 'react';
import { useActorRef } from './useActorRef';
import { useSelector as useSelectorUnbound } from './useSelector';
import {
  ActorRefFrom,
  AnyStateMachine,
  SnapshotFrom,
  InterpreterOptions,
  Observer,
  AreAllImplementationsAssumedToBeProvided,
  MarkAllImplementationsAsProvided,
  StateMachine,
  AnyActorLogic
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

export function createActorContext<TMachine extends AnyActorLogic>(
  actorLogic: TMachine,
  interpreterOptions?: InterpreterOptions<TMachine>,
  observerOrListener?:
    | Observer<SnapshotFrom<TMachine>>
    | ((value: SnapshotFrom<TMachine>) => void)
): {
  useSelector: <T>(
    selector: (snapshot: SnapshotFrom<TMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ) => T;
  useActorRef: () => ActorRefFrom<TMachine>;
  Provider: (
    props: {
      children: React.ReactNode;
    } & (TMachine extends AnyStateMachine
      ? AreAllImplementationsAssumedToBeProvided<
          TMachine['__TResolvedTypesMeta']
        > extends true
        ? {
            logic?: TMachine;
          }
        : {
            logic: ToMachinesWithProvidedImplementations<TMachine>;
          }
      : { logic?: TMachine })
  ) => React.ReactElement<any, any>;
} {
  const ReactContext = React.createContext<ActorRefFrom<TMachine> | null>(null);

  const OriginalProvider = ReactContext.Provider;

  function Provider({
    children,
    logic: providedLogic = actorLogic,
    machine
  }: {
    children: React.ReactNode;
    logic: TMachine;
    /**
     * @deprecated Use `logic` instead.
     */
    machine?: never;
  }) {
    if (machine) {
      throw new Error(
        `The "machine" prop has been deprecated. Please use "logic" instead.`
      );
    }

    const actor = (useActorRef as any)(
      providedLogic,
      interpreterOptions,
      observerOrListener
    ) as ActorRefFrom<TMachine>;

    return React.createElement(OriginalProvider, { value: actor, children });
  }

  // TODO: add properties to actor ref to make more descriptive
  Provider.displayName = `ActorProvider`;

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
