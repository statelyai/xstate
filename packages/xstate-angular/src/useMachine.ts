import { ActorOptions, isActorLogic, AnyStateMachine } from 'xstate';
import { ActorStoreProps, useActor, UseActorConfig } from './useActor.ts';
import { Type } from '@angular/core';

export function useMachine<TMachine extends AnyStateMachine>(
  provided: UseActorConfig,
  actorLogic: TMachine,
  options?: ActorOptions<TMachine>
): Type<ActorStoreProps<TMachine>>;
export function useMachine<TMachine extends AnyStateMachine>(
  actorLogic: TMachine,
  options?: ActorOptions<TMachine>
): Type<ActorStoreProps<TMachine>>;
/**
 * @alias useActor
 */
export function useMachine<TMachine extends AnyStateMachine>(
  providedInOrActor: UseActorConfig | TMachine,
  actorLogicOrOptions?: TMachine | ActorOptions<TMachine>,
  _options?: ActorOptions<TMachine>
): Type<ActorStoreProps<TMachine>> {
  if ('providedIn' in providedInOrActor && isActorLogic(actorLogicOrOptions)) {
    return useActor(providedInOrActor, actorLogicOrOptions, _options) as Type<
      ActorStoreProps<TMachine>
    >;
  } else if (isActorLogic(providedInOrActor)) {
    return useActor(providedInOrActor, actorLogicOrOptions) as Type<
      ActorStoreProps<TMachine>
    >;
  } else {
    throw new Error('useMachine: parameters do not match type signature');
  }
}
