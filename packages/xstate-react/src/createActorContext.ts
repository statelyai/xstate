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
  EventFromBehavior,
  AnyActorBehavior,
  AnyActorRef
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

export function createActorContext<TBehavior extends AnyActorBehavior>(
  machine: TBehavior,
  interpreterOptions?: InterpreterOptions<TBehavior>,
  observerOrListener?:
    | Observer<SnapshotFrom<TBehavior>>
    | ((value: SnapshotFrom<TBehavior>) => void)
): {
  useSnapshot: () => [
    SnapshotFrom<TBehavior>,
    (event: EventFromBehavior<TBehavior>) => void,
    ActorRefFrom<TBehavior>
  ];
  useSelector: <T>(
    selector: (snapshot: SnapshotFrom<TBehavior>) => T,
    compare?: (a: T, b: T) => boolean
  ) => T;
  useActorRef: () => ActorRefFrom<TBehavior>;
  Provider: (
    props: {
      children: React.ReactNode;
    } & (TBehavior extends AnyStateMachine
      ? AreAllImplementationsAssumedToBeProvided<
          TBehavior['__TResolvedTypesMeta']
        > extends true
        ? {
            machine?: TBehavior;
          }
        : {
            machine: ToMachinesWithProvidedImplementations<TBehavior>;
          }
      : {
          machine?: TBehavior;
        })
  ) => React.ReactElement<any, any>;
} {
  const ReactContext = React.createContext<ActorRefFrom<TBehavior> | null>(
    null
  );

  const OriginalProvider = ReactContext.Provider;

  function Provider({
    children,
    machine: providedMachine = machine
  }: {
    children: React.ReactNode;
    machine: TBehavior;
  }) {
    const actor = (useActorRef as any)(
      providedMachine,
      interpreterOptions,
      observerOrListener
    ) as ActorRefFrom<TBehavior>;

    return React.createElement(OriginalProvider, { value: actor, children });
  }

  Provider.displayName = `ActorProvider(${
    (machine as unknown as AnyStateMachine).id ?? machine.transition.name
  })`;

  function useContext(): ActorRefFrom<TBehavior> {
    const actor = React.useContext(ReactContext);

    if (!actor) {
      throw new Error(
        `You used a hook from "${Provider.displayName}" but it's not inside a <${Provider.displayName}> component.`
      );
    }

    return actor;
  }

  function useSelector<T>(
    selector: (snapshot: SnapshotFrom<TBehavior>) => T,
    compare?: (a: T, b: T) => boolean
  ): T {
    const actor = useContext();
    return useSelectorUnbound(actor, selector, compare);
  }

  function useSnapshot(): [
    SnapshotFrom<TBehavior>,
    (event: EventFromBehavior<TBehavior>) => void,
    ActorRefFrom<TBehavior>
  ] {
    const actor = useContext();
    const state = useSelector((s) => s);

    return [state, (actor as AnyActorRef).send, actor];
  }

  return {
    Provider: Provider as any,
    useActorRef: useContext,
    useSelector,
    useSnapshot
  };
}
