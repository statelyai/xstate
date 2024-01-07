import { onDestroy } from 'svelte';
import { Actor, ActorOptions, AnyActorLogic, createActor } from 'xstate';

export function useActorRef<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: ActorOptions<TLogic>
): Actor<TLogic> {
  const actorRef = createActor(logic, options).start();
  onDestroy(() => actorRef.stop());
  return actorRef;
}
