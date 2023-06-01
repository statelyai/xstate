import type { ActorRefFrom, AnyActorLogic } from 'xstate';
import { interpret } from 'xstate';
import type { RestParams } from './types.ts';
import { onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';

export function createActorRef<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  ...[options = {}]: RestParams<TLogic>
): ActorRefFrom<TLogic> {
  const actorRef = interpret(actorLogic, options);

  if (!isServer) {
    actorRef.start();
    onCleanup(() => actorRef.stop());
  }

  return actorRef as unknown as ActorRefFrom<TLogic>;
}
