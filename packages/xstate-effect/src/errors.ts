import { Cause, Data } from 'effect';
import type { Snapshot } from 'xstate';

/** Preserves an Effect failure, defect or interruption through XState error routing. */
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
 * Reported by `waitFor` when the actor stops or errors before a snapshot
 * matches, and by `join` when the actor stops without output. `join` reports
 * an errored actor's outcome instead, preserving an Effect failure's Cause.
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
 */
export class NotReadyError extends Data.TaggedError('NotReadyError') {
  override get message(): string {
    return 'The actor is not ready yet';
  }
}

/** @internal Replays genuine Effect failures; ordinary actor errors remain typed failures. */
export function causeFromError<E>(
  error: E
): Cause.Cause<UnwrapEffectFailure<E>> {
  return (
    error instanceof EffectFailure ? error.cause : Cause.fail(error)
  ) as Cause.Cause<UnwrapEffectFailure<E>>;
}

export type UnwrapEffectFailure<E> =
  E extends EffectFailure<infer Failure> ? Failure : E;

/** An event rejected at the actor's delivery boundary. */
export class EventRejectedError extends Data.TaggedError('EventRejectedError')<{
  readonly actorId: string;
  readonly event: { readonly type: string };
  readonly reason: string;
}> {}
