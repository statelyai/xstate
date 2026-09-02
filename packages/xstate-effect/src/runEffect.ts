import type { Effect } from 'effect';
import type { AnyActorRef } from 'xstate';
import { runHostedEffect } from './internal.ts';

/**
 * Runs an Effect in the host context of `self`, for use inside inline machine
 * actions:
 *
 * ```ts
 * on: {
 *   SAVE: (args, enq) => enq(runEffect, args.self, save(args.context))
 * }
 * ```
 *
 * The Effect is interrupted when the actor stops. Failures and defects route
 * through the actor's `onError` handling, like a rejected async action. The
 * Effect's service requirements are satisfied from the context captured by
 * `createEffectActor` and are not reflected in `RequirementsFrom`; register
 * the action with `setupEffect` for typed requirements.
 */
export function runEffect(
  self: AnyActorRef,
  effect: Effect.Effect<unknown, unknown, any>
): PromiseLike<void> {
  return runHostedEffect(self, effect);
}
