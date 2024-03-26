import { ActorOptions, AnyStateMachine } from 'xstate';
import { ActorStoreProps, useActor } from './useActor.ts';
import { Type } from '@angular/core';

/**
 * @alias useActor
 */
export function useMachine<TMachine extends AnyStateMachine>(
  actorLogic: TMachine,
  options?: ActorOptions<TMachine> & { providedIn: 'root' }
): Type<ActorStoreProps<TMachine>> {
  return useActor(actorLogic, options);
}
