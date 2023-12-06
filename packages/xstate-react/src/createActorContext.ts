import * as React from 'react';
import { useActorRef } from './useActorRef';
import { useSelector as useSelectorUnbound } from './useSelector';
import {
  ActorRefFrom,
  AnyStateMachine,
  SnapshotFrom,
  ActorOptions,
  AreAllImplementationsAssumedToBeProvided,
  MarkAllImplementationsAsProvided,
  StateMachine,
  AnyActorLogic
} from 'xstate';

type ToMachinesWithProvidedImplementations<TMachine extends AnyStateMachine> =
  TMachine extends StateMachine<
    infer TContext,
    infer TEvent,
    infer TChildren,
    infer TActor,
    infer TAction,
    infer TGuard,
    infer TDelay,
    infer TStateValue,
    infer TTag,
    infer TInput,
    infer TOutput,
    infer TResolvedTypesMeta
  >
    ? StateMachine<
        TContext,
        TEvent,
        TChildren,
        TActor,
        TAction,
        TGuard,
        TDelay,
        TStateValue,
        TTag,
        TInput,
        TOutput,
        AreAllImplementationsAssumedToBeProvided<TResolvedTypesMeta> extends false
          ? MarkAllImplementationsAsProvided<TResolvedTypesMeta>
          : TResolvedTypesMeta
      >
    : never;

export function createActorContext<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  interpreterOptions?: ActorOptions<TLogic>
): {
  useSelector: <T>(
    selector: (snapshot: SnapshotFrom<TLogic>) => T,
    compare?: (a: T, b: T) => boolean
  ) => T;
  useActorRef: () => ActorRefFrom<TLogic>;
  Provider: (
    props: {
      children: React.ReactNode;
      options?: ActorOptions<TLogic>;
      /**
       * @deprecated Use `logic` instead.
       */
      machine?: never;
    } & (TLogic extends AnyStateMachine
      ? AreAllImplementationsAssumedToBeProvided<
          TLogic['__TResolvedTypesMeta']
        > extends true
        ? {
            logic?: TLogic;
          }
        : {
            logic: ToMachinesWithProvidedImplementations<TLogic>;
          }
      : { logic?: TLogic })
  ) => React.ReactElement<any, any>;
} {
  const ReactContext = React.createContext<ActorRefFrom<TLogic> | null>(null);

  const OriginalProvider = ReactContext.Provider;

  function Provider({
    children,
    logic: providedLogic = actorLogic,
    machine,
    options: providedOptions = interpreterOptions
  }: {
    children: React.ReactNode;
    logic: TLogic;
    /**
     * @deprecated Use `logic` instead.
     */
    machine?: never;
    options?: ActorOptions<TLogic>;
  }) {
    if (machine) {
      throw new Error(
        `The "machine" prop has been deprecated. Please use "logic" instead.`
      );
    }

    const actor = (useActorRef as any)(
      providedLogic,
      providedOptions
    ) as ActorRefFrom<TLogic>;

    return React.createElement(OriginalProvider, {
      value: actor,
      children
    });
  }

  // TODO: add properties to actor ref to make more descriptive
  Provider.displayName = `ActorProvider`;

  function useContext(): ActorRefFrom<TLogic> {
    const actor = React.useContext(ReactContext);

    if (!actor) {
      throw new Error(
        `You used a hook from "${Provider.displayName}" but it's not inside a <${Provider.displayName}> component.`
      );
    }

    return actor;
  }

  function useSelector<T>(
    selector: (snapshot: SnapshotFrom<TLogic>) => T,
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
