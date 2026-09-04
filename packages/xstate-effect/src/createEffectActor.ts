import { Context, Effect, Exit, Fiber, Scope } from 'effect';
import {
  createActor,
  type Actor,
  type ActorOptions,
  type AnyActorLogic,
  type RequiredActorOptionsKeys
} from 'xstate';
import { createEffectClock } from './clock.ts';
import {
  bindEffectHost,
  closeEffectHost,
  createEffectHost,
  type EffectHost
} from './internal.ts';
import type { RequirementsFrom } from './types.ts';

/**
 * Creates and starts an actor whose Effect-backed logic, actions and timers
 * run in the current Effect context.
 *
 * The actor is a scoped resource: it stops, and its running Effects are
 * interrupted, when the enclosing `Scope` closes. Effects hosted by the actor
 * see a `Scope` that closes when the actor stops, so `Effect.addFinalizer`
 * and `Effect.acquireRelease` inside them release with the actor.
 *
 * The returned Effect never fails. Starting logic that needs an Effect host
 * outside `createEffectActor`, or spawning undeclared Effect logic, is a
 * programming error that surfaces as the actor's `error` status.
 *
 * XState timers use the Effect `Clock` service by default, so `TestClock`
 * drives delayed transitions. Pass `options.clock` to override.
 */
export function createEffectActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: ActorOptions<TLogic> & {
    [K in RequiredActorOptionsKeys<TLogic>]: unknown;
  }
): Effect.Effect<Actor<TLogic>, never, RequirementsFrom<TLogic> | Scope.Scope> {
  return Effect.acquireRelease(
    Effect.gen(function* () {
      const parentScope = yield* Effect.scope;
      const actorScope = yield* Scope.fork(parentScope);
      const baseContext = yield* Effect.context<never>();
      const context = Context.add(baseContext, Scope.Scope, actorScope);
      const host = createEffectHost(context, actorScope);
      const actor = createActor(logic, {
        ...(options as ActorOptions<TLogic>),
        clock: options?.clock ?? createEffectClock(context)
      });
      bindEffectHost(actor, host);
      actor.subscribe({
        passive: true,
        error: () => closeEffectHost(host),
        complete: () => closeEffectHost(host)
      });
      actor.start();
      return { actor, host };
    }),
    ({ actor, host }) =>
      Effect.gen(function* () {
        actor.stop();
        if (host.closing) {
          yield* Fiber.join(host.closing);
        } else {
          yield* Scope.close(host.scope, Exit.void);
        }
      })
  ).pipe(
    Effect.map(({ actor }: { actor: Actor<TLogic>; host: EffectHost }) => actor)
  ) as unknown as Effect.Effect<
    Actor<TLogic>,
    never,
    RequirementsFrom<TLogic> | Scope.Scope
  >;
}
