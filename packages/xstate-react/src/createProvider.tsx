import * as React from 'react';
import { createContext, useContext } from 'react';
import { useInterpret } from './useInterpret';
import { useActor } from './useActor';
import { useSelector } from './useSelector';
import { ActorRefFrom, AnyStateMachine, EmittedFrom, EventFrom } from 'xstate';

export function createProvider<TMachine extends AnyStateMachine>(
  machine: TMachine
): {
  (props: { children: React.ReactNode }): React.ReactElement<any, any>;
  useActor: () => [
    EmittedFrom<ActorRefFrom<TMachine>>,
    (event: EventFrom<TMachine>) => void
  ];
  useSelector: <T>(
    selector: (snapshot: EmittedFrom<TMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ) => T;
  useContext: () => ActorRefFrom<TMachine>;
} {
  const ReactContext = createContext<ActorRefFrom<TMachine> | null>(null);

  function Provider({ children }: { children: React.ReactNode }) {
    const actor = useInterpret(machine) as ActorRefFrom<TMachine>;

    return (
      <ReactContext.Provider value={actor}>{children}</ReactContext.Provider>
    );
  }

  Provider.displayName = `Provider(${machine.id})`;

  Provider.useContext = () => {
    const actor = useContext(ReactContext);

    if (!actor) {
      throw new Error(
        `You used Provider.useContext() but it's not inside a <Provider>.`
      );
    }

    return actor;
  };

  Provider.useActor = () => {
    const actor = Provider.useContext();

    return useActor(actor);
  };

  Provider.useSelector = <T,>(
    selector: (snapshot: EmittedFrom<TMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ): T => {
    const actor = Provider.useContext();

    return useSelector(actor, selector, compare);
  };

  return Provider;
}
