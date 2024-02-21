import { onCleanup, onMount } from 'solid-js';
import type { ActorOptions, ActorRefFrom, AnyActorLogic } from 'xstate';
import { createActor } from 'xstate';

export function useActorRef<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: ActorOptions<TLogic>
): ActorRefFrom<TLogic> {
  const actorRef = createActor(logic, options);

  onMount(() => {
    actorRef.start();
    onCleanup(() => actorRef.stop());
  });

  return actorRef as any;
}
