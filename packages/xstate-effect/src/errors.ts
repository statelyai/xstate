import { Cause, Data } from 'effect';
import type { Snapshot } from 'xstate';

/**
 * The failure an Effect-backed actor reports when its Effect was interrupted
 * by something other than the actor being stopped, such as `Effect.interrupt`,
 * losing an `Effect.race`, or an `Effect.timeout` that interrupts.
 */
export class EffectInterruptedError extends Data.TaggedError(
  'EffectInterruptedError'
)<{
  readonly cause: Cause.Cause<never>;
}> {
  override get message(): string {
    return 'Effect was interrupted before the actor completed';
  }
}

/**
 * Reported by `join` and `waitFor` when the actor stops or errors before
 * producing the awaited result.
 */
export class ActorStoppedError extends Data.TaggedError('ActorStoppedError')<{
  readonly actorId: string;
  readonly snapshot: Snapshot<unknown>;
}> {
  override get message(): string {
    return `Actor "${this.actorId}" ${
      this.snapshot.status === 'error' ? 'errored' : 'stopped'
    } before completing`;
  }
}
