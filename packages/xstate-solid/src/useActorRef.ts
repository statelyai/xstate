import { onCleanup, onMount } from 'solid-js';
import type {
  ActorOptions,
  ActorRefFrom,
  AnyActorLogic,
  ConditionalRequired,
  IsNotNever,
  RequiredActorOptionsKeys,
  RequiredActorOptionsFor
} from 'xstate';
import { createActor } from 'xstate';

export function useActorRef<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [options?: ActorOptions<TLogic> & RequiredActorOptionsFor<TLogic>],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): ActorRefFrom<TLogic> {
  const actorRef = createActor(logic, options as ActorOptions<TLogic>);

  onMount(() => {
    actorRef.start();
    onCleanup(() => actorRef.stop());
  });

  return actorRef as any;
}
