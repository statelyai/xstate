import { Clock, Context, Duration, Effect, Fiber, Scope } from 'effect';
import type { ActorOptions, AnyActorLogic } from 'xstate';

type XStateClock = NonNullable<ActorOptions<AnyActorLogic>['clock']>;

/**
 * An XState clock that schedules delays with `Effect.sleep` in the given
 * context, so timers follow the Effect `Clock` service (including
 * `TestClock`). Timer fibers run in the context's `Scope` and are
 * interrupted when it closes.
 */
export function createEffectClock(
  context: Context.Context<Scope.Scope>
): XStateClock {
  const clock = Context.get(context, Clock.Clock);
  const scope = Context.get(context, Scope.Scope);
  const runFork = Effect.runForkWith(context);
  return {
    setTimeout: (fn: () => void, timeout: number) =>
      Fiber.runIn(
        runFork(
          Effect.andThen(
            Effect.sleep(Duration.millis(timeout)),
            Effect.sync(fn)
          )
        ),
        scope
      ),
    clearTimeout: (id: Fiber.Fiber<void>) => {
      id.interruptUnsafe();
    },
    now: () => clock.currentTimeMillisUnsafe()
  };
}
