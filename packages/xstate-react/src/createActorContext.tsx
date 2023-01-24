import * as React from 'react';
import { createContext, useContext } from 'react';
import { useInterpret } from './useInterpret';
import { useActor } from './useActor';
import { useSelector } from './useSelector';
import { ActorRefFrom, AnyStateMachine, EmittedFrom, EventFrom } from 'xstate';

export function createActorContext<TMachine extends AnyStateMachine>(
  machine: TMachine
): React.Context<ActorRefFrom<TMachine>> & {
  // (props: { children: React.ReactNode }): React.ReactElement<any, any>;
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
  }) => React.ReactElement<any, any>;
} {
  const ReactContext = createContext<ActorRefFrom<TMachine> | null>(
    null
  ) as any; // TODO: fix types

  const OriginalProvider = ReactContext.Provider;

  function Provider({ children }: { children: React.ReactNode }) {
    const actor = useInterpret(machine) as ActorRefFrom<TMachine>;

    return <OriginalProvider value={actor}>{children}</OriginalProvider>;
  }

  Provider.displayName = `Provider(${machine.id})`;

  ReactContext.useContext = () => {
    const actor = useContext(ReactContext) as any;

    if (!actor) {
      throw new Error(
        `You used Provider.useContext() but it's not inside a <Provider>.`
      );
    }

    return actor;
  };

  ReactContext.useActor = () => {
    const actor = useContext(ReactContext) as any;

    return useActor(actor);
  };

  ReactContext.useSelector = <T,>(
    selector: (snapshot: EmittedFrom<TMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ): T => {
    const actor = useContext(ReactContext) as any;

    return useSelector(actor, selector, compare);
  };

  ReactContext.Provider = Provider;

  return ReactContext;
}
