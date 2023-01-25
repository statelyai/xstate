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
  useContext: () => ActorRefFrom<TMachine>;
  Provider: (props: {
    children: React.ReactNode;
    value?: TMachine | (() => TMachine);
  }) => React.ReactElement<any, any>;
} {
  const ReactContext = React.createContext<ActorRefFrom<TMachine> | null>(null);

  const OriginalProvider = ReactContext.Provider;

  function Provider({
    children,
    value = machine
  }: {
    children: React.ReactNode;
    value: TMachine;
  }) {
    const actor = useInterpret(value) as ActorRefFrom<TMachine>;

    return <OriginalProvider value={actor}>{children}</OriginalProvider>;
  }

  Provider.displayName = `Provider(${machine.id})`;

  function useContext() {
    const actor = React.useContext(ReactContext);

    if (!actor) {
      throw new Error(
        `You used Provider.useContext() but it's not inside a <Provider>.`
      );
    }

    return actor;
  }

  function useActor() {
    const actor = useContext();
    return useActorUnbound(actor);
  }

  function useSelector<T>(
    selector: (snapshot: EmittedFrom<TMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ): T {
    const actor = useContext();
    return useSelectorUnbound(actor, selector, compare);
  }

  return {
    Provider,
    useContext,
    useActor,
    useSelector
  };
}
