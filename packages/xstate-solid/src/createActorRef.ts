import type { ActorRefFrom, AnyActorBehavior } from 'xstate';
import { interpret } from 'xstate';
import type { RestParams } from './types.ts';
import { onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';

export function createActorRef<TBehavior extends AnyActorBehavior>(
  behavior: TBehavior,
  ...[options = {}]: RestParams<TBehavior>
): ActorRefFrom<TBehavior> {
  const actorRef = interpret(behavior, options);

  if (!isServer) {
    actorRef.start();
    onCleanup(() => actorRef.stop());
  }

  return actorRef as unknown as ActorRefFrom<TBehavior>;
}
