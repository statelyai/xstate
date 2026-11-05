import {
  Actor,
  ActorOptions,
  AnyStateMachine,
  StateFrom,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys,
  type RequiredActorOptionsFor
} from 'xstate';
import { useActor } from './useActor.ts';

/**
 * @alias useActor
 *
 * @deprecated Use `useActor(machine, options)`.
 * @public
 */
export function useMachine<TMachine extends AnyStateMachine>(
  actor: Actor<TMachine>
): [StateFrom<TMachine>, Actor<TMachine>['send'], Actor<TMachine>];
export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options]: ConditionalRequired<
    [options?: ActorOptions<TMachine> & RequiredActorOptionsFor<TMachine>],
    IsNotNever<RequiredActorOptionsKeys<TMachine>>
  >
): [StateFrom<TMachine>, Actor<TMachine>['send'], Actor<TMachine>];
export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine | Actor<TMachine>,
  options?: ActorOptions<TMachine>
): [StateFrom<TMachine>, Actor<TMachine>['send'], Actor<TMachine>] {
  return (useActor as any)(machine, options);
}
