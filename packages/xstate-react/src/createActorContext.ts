import * as React from 'react';
import { Actor, ActorOptions, AnyActorLogic, SnapshotFrom } from 'xstate';
import { useActorRef } from './useActorRef';
import { useSelector as useSelectorUnbound } from './useSelector';

export function createActorContext<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  actorOptions?: ActorOptions<TLogic>
): {
  useSelector: <T>(
    selector: (snapshot: SnapshotFrom<TLogic>) => T,
    compare?: (a: T, b: T) => boolean
  ) => T;
  useActorRef: () => Actor<TLogic>;
  Provider: (props: {
    children: React.ReactNode;
    options?: ActorOptions<TLogic>;
    /** @deprecated Use `logic` instead. */
    machine?: never;
    logic?: TLogic;
  }) => React.ReactElement<any, any>;
} {
  const ReactContext = React.createContext<Actor<TLogic> | null>(null);

  const OriginalProvider = ReactContext.Provider;

  function Provider({
    children,
    logic: providedLogic = actorLogic,
    machine,
    options: providedOptions
  }: {
    children: React.ReactNode;
    logic: TLogic;
    /** @deprecated Use `logic` instead. */
    machine?: never;
    options?: ActorOptions<TLogic>;
  }) {
    if (machine) {
      throw new Error(
        `The "machine" prop has been deprecated. Please use "logic" instead.`
      );
    }

    const actor = useActorRef(providedLogic, {
      ...actorOptions,
      ...providedOptions
    });

    return React.createElement(OriginalProvider, {
      value: actor,
      children
    });
  }

  // TODO: add properties to actor ref to make more descriptive
  Provider.displayName = `ActorProvider`;

  function useContext(): Actor<TLogic> {
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
