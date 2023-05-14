import type { ActorRefFrom, AnyActorBehavior } from 'xstate';
import { interpret } from 'xstate';
import type { RestParams } from './types.ts';
import { onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';

export function createActorRef<TBehavior extends AnyActorBehavior>(
  behavior: TBehavior,
  ...[options = {}]: RestParams<TBehavior>
): ActorRefFrom<TBehavior> {
  const machineWithConfig = behavior;

  const service = interpret(machineWithConfig, options);

  if (!isServer) {
    service.start();
    onCleanup(() => service.stop());
  }

  return service as unknown as ActorRefFrom<TBehavior>;
}
