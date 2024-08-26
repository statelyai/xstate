import { onDestroy } from 'svelte';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  createActor,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorInstanceOptions
} from 'xstate';

export function useActorRef<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [
      options?: ActorOptions<TLogic> & {
        [K in RequiredActorInstanceOptions<TLogic>]: unknown;
      }
    ],
    IsNotNever<RequiredActorInstanceOptions<TLogic>>
  >
): Actor<TLogic> {
  const actorRef = createActor(logic, options).start();
  onDestroy(() => actorRef.stop());
  return actorRef;
}
