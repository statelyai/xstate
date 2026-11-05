import * as React from 'react';
import { Actor, ActorOptions, AnyActorLogic, SnapshotFrom } from 'xstate';
import { useActorRef } from './useActorRef';
import { useSelector as useSelectorUnbound } from './useSelector';

/** @public */
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
    logic?: TLogic;
    /**
     * An already-created actor (e.g. from `restoreActor`) to provide instead
     * of creating one from `logic` and `options`. Create it once.
     */
    actor?: Actor<TLogic>;
  }) => React.ReactElement<any, any>;
} {
  const ReactContext = React.createContext<Actor<TLogic> | null>(null);

  const OriginalProvider = ReactContext.Provider;

  function Provider({
    children,
    logic: providedLogic = actorLogic,
    options: providedOptions,
    actor: providedActor
  }: {
    children: React.ReactNode;
    logic: TLogic;
    options?: ActorOptions<TLogic>;
    actor?: Actor<TLogic>;
  }) {
    const actor = (useActorRef as any)(
      providedActor ?? providedLogic,
      providedActor ? undefined : { ...actorOptions, ...providedOptions }
    ) as Actor<TLogic>;

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
