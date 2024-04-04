import { ActorOptions, AnyStateMachine } from 'xstate';
import { useActor } from './useActor.ts';

/**
 * @alias useActor
 */
export function useMachine<TMachine extends AnyStateMachine>(
  actorLogic: TMachine,
  options?: ActorOptions<TMachine> & { providedIn: 'root' }
) {
  return useActor(actorLogic, options);
}
