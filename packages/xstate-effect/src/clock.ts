import { Clock, Context, Duration, Effect, type Fiber } from 'effect';
import type { ActorOptions, AnyActorLogic } from 'xstate';

type XStateClock = NonNullable<ActorOptions<AnyActorLogic>['clock']>;

/**
 * An XState clock that schedules delays with `Effect.sleep` in the given
 * context, so timers follow the Effect `Clock` service (including
 * `TestClock`).
 */
export function createEffectClock(
  context: Context.Context<never>
): XStateClock {
  const runFork = Effect.runForkWith(context);
  const runSync = Effect.runSyncWith(context);
  return {
    setTimeout: (fn: () => void, timeout: number) =>
      runFork(
        Effect.andThen(Effect.sleep(Duration.millis(timeout)), Effect.sync(fn))
      ),
    clearTimeout: (id: Fiber.Fiber<void>) => {
      id.interruptUnsafe();
    },
    now: () => runSync(Clock.currentTimeMillis)
  };
}
