import { Cause, Data } from 'effect';
import type { Snapshot } from 'xstate';

/**
 * Preserves an Effect failure, defect or interruption through XState error routing.
 *
 * @experimental
 */
export class EffectFailure<E> extends Error {
  readonly _tag = 'EffectFailure';
  readonly #effectFailure = true;

  static is(value: unknown): value is EffectFailure<unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      #effectFailure in value &&
      value.#effectFailure
    );
  }

  constructor(readonly cause: Cause.Cause<E>) {
    super(Cause.pretty(cause));
    this.name = 'EffectFailure';
  }
}

/**
 * @deprecated Inspect `EffectFailure.cause` for interruption instead.
 *
 * @experimental
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
 * Reported by `waitFor` when the actor stops or errors before a snapshot
 * matches, and by `join` when the actor stops without output. `join` reports
 * an errored actor's outcome instead, preserving an Effect failure's Cause.
 *
 * @experimental
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

/**
 * Reported by the `send` atom of `createActorAtoms` when an event is sent
 * before the actor's runtime has finished building.
 *
 * @experimental
 */
export class NotReadyError extends Data.TaggedError('NotReadyError') {
  override get message(): string {
    return 'The actor is not ready yet';
  }
}

/**
 * Returns an EffectFailure's original Cause, or wraps an ordinary error with
 * Cause.fail. Defects and interruption in an existing Cause are preserved.
 *
 * @experimental
 */
export function causeFromError<E>(
  error: E
): Cause.Cause<UnwrapEffectFailure<E>> {
  return (
    error instanceof EffectFailure ? error.cause : Cause.fail(error)
  ) as Cause.Cause<UnwrapEffectFailure<E>>;
}

/**
 * Extracts the typed failure from EffectFailure while retaining ordinary errors.
 *
 * @experimental
 */
export type UnwrapEffectFailure<E> =
  E extends EffectFailure<infer Failure> ? Failure : E;

/**
 * An event rejected at the actor's delivery boundary.
 *
 * @experimental
 */
export class EventRejectedError extends Data.TaggedError('EventRejectedError')<{
  readonly actorId: string;
  readonly event: { readonly type: string };
  readonly reason: string;
}> {}
