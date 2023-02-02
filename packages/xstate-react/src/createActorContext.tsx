import * as React from 'react';
import { RestParams, useInterpret } from './useInterpret';
import { useActor as useActorUnbound } from './useActor';
import { useSelector as useSelectorUnbound } from './useSelector';
import { ActorRefFrom, AnyStateMachine, EmittedFrom } from 'xstate';

export function createActorContext<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options = {}, observerOrListener]: RestParams<TMachine>
): {
  useActor: () => ReturnType<typeof useActorUnbound<ActorRefFrom<TMachine>>>;
  useSelector: <T>(
    selector: (snapshot: EmittedFrom<TMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ) => T;
  useActorRef: () => ActorRefFrom<TMachine>;
  Provider: (props: {
    children: React.ReactNode;
    machine?: TMachine | (() => TMachine);
  }) => React.ReactElement<any, any>;
} {
  const ReactContext = React.createContext<ActorRefFrom<TMachine> | null>(null);

  const OriginalProvider = ReactContext.Provider;

  function Provider({
    children,
    machine: providedMachine = machine
  }: {
    children: React.ReactNode;
    machine: TMachine | (() => TMachine);
  }) {
    const actor = useInterpret(
      providedMachine,
      options,
      observerOrListener
    ) as ActorRefFrom<TMachine>;

    return <OriginalProvider value={actor}>{children}</OriginalProvider>;
  }

  Provider.displayName = `ActorProvider(${machine.id})`;

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
    selector: (snapshot: EmittedFrom<TMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ): T {
    const actor = useContext();
    return useSelectorUnbound(actor, selector, compare);
  }

  return {
    Provider,
    useActorRef: useContext,
    useActor,
    useSelector
  };
}
