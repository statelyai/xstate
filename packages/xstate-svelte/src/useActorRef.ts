import { onDestroy } from 'svelte';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  createActor,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredOptions
} from 'xstate';

export function useActorRef<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [
      options?: ActorOptions<TLogic> & {
        [K in RequiredOptions<TLogic>]: unknown;
      }
    ],
    IsNotNever<RequiredOptions<TLogic>>
  >
): Actor<TLogic> {
  const actorRef = createActor(logic, options).start();
  onDestroy(() => actorRef.stop());
  return actorRef;
}
