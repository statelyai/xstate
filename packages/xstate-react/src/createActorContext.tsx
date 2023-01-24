import * as React from 'react';
import { useInterpret } from './useInterpret';
import { useActor as useActorUnbound } from './useActor';
import { useSelector as useSelectorUnbound } from './useSelector';
import { ActorRefFrom, AnyStateMachine, EmittedFrom, EventFrom } from 'xstate';

export function createActorContext<TMachine extends AnyStateMachine>(
  machine: TMachine
): {
  useActor: () => [
    EmittedFrom<ActorRefFrom<TMachine>>,
    (event: EventFrom<TMachine>) => void
  ];
  useSelector: <T>(
    selector: (snapshot: EmittedFrom<TMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ) => T;
  useActorRef: () => ActorRefFrom<TMachine>;
  Provider: (props: {
    children: React.ReactNode;
  }) => React.ReactElement<any, any>;
} {
  const ReactContext = React.createContext<ActorRefFrom<TMachine> | null>(null);

  const OriginalProvider = ReactContext.Provider;

  function Provider({ children }: { children: React.ReactNode }) {
    const actor = useInterpret(machine) as ActorRefFrom<TMachine>;

    return <OriginalProvider value={actor}>{children}</OriginalProvider>;
  }

  Provider.displayName = `Provider(${machine.id})`;

  function useActorRef() {
    const actor = React.useContext(ReactContext);

    if (!actor) {
      throw new Error(
        `You used Provider.useContext() but it's not inside a <Provider>.`
      );
    }

    return actor;
  }

  function useActor() {
    const actor = useActorRef();
    return useActorUnbound(actor);
  }

  function useSelector<T>(
    selector: (snapshot: EmittedFrom<TMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ): T {
    const actor = useActorRef();
    return useSelectorUnbound(actor, selector, compare);
  }

  return {
    Provider,
    useActorRef,
    useActor,
    useSelector
  };
}
