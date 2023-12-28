import { onDestroy } from 'svelte';
import { ActorOptions, ActorRefFrom, AnyActorLogic, createActor } from 'xstate';

export function useActorRef<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: ActorOptions<TLogic>
): ActorRefFrom<TLogic> {
  const actorRef = createActor(logic as any, options).start();
  onDestroy(() => actorRef.stop());
  return actorRef as any;
}
