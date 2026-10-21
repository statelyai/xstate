import { Context, Effect, Scope } from 'effect';

/** The owning Effect actor's scope, supplied by `createEffectActor`. */
export class ActorScope extends Context.Service<ActorScope, Scope.Scope>()(
  '@xstate/effect/ActorScope'
) {}

/**
 * Acquires resources in the owning actor's scope. Their finalizers run when
 * that actor stops, even if the invoking task finishes or is cancelled first.
 */
export function withActorScope<A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, Exclude<R, Scope.Scope> | ActorScope> {
  return ActorScope.use((scope) => Scope.provide(effect, scope));
}
