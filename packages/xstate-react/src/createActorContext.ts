import * as React from 'react';
import { useActor as useActorUnbound } from './useActor';
import { useSelector as useSelectorUnbound } from './useSelector';
import { SnapshotFrom, AnyActorRef } from 'xstate';

export function createActorContext<TActor extends AnyActorRef>(
  actorRef: TActor
): {
  useActor: () => [SnapshotFrom<TActor>, TActor['send']];
  useSelector: <T>(
    selector: (snapshot: SnapshotFrom<TActor>) => T,
    compare?: (a: T, b: T) => boolean
  ) => T;
  useActorRef: () => TActor;
  Provider: (props: {
    children: React.ReactNode;
    actorRef?: TActor;
  }) => React.ReactElement<any, any>;
} {
  const ReactContext = React.createContext<TActor | null>(null);

  const OriginalProvider = ReactContext.Provider;

  function Provider({
    children,
    actorRef: resolvedActorRef = actorRef
  }: {
    children: React.ReactNode;
    actorRef?: TActor;
  }) {
    React.useEffect(() => {
      // Start the actor if it's not already started
      resolvedActorRef.start?.();
    }, []);

    return React.createElement(OriginalProvider, {
      value: resolvedActorRef,
      children
    });
  }

  Provider.displayName = `ActorProvider(${actorRef.id})`;

  function useContext() {
    const actor = React.useContext(ReactContext);

    if (!actor) {
      throw new Error(
        `You used a hook from "${Provider.displayName}" but it's not inside a <${Provider.displayName}> component.`
      );
    }

    return actor;
  }

  function useActor() {
    const actor = useContext();
    return useActorUnbound(actor);
  }

  function useSelector<T>(
    selector: (snapshot: SnapshotFrom<TActor>) => T,
    compare?: (a: T, b: T) => boolean
  ): T {
    const actor = useContext();
    return useSelectorUnbound(actor, selector, compare);
  }

  return {
    Provider: Provider as any,
    useActorRef: useContext,
    useActor,
    useSelector
  };
}
