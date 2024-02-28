import { Actor, ActorOptions, AnyActorLogic, createActor } from 'xstate';

export const useActorRef = <TMachine extends AnyActorLogic>(
  logic: TMachine,
  options?: ActorOptions<TMachine>
): Actor<TMachine> => {
  const actorRef = createActor(logic, options);
  return actorRef;
};
