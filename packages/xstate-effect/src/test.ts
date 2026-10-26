import type { Effect } from 'effect';
import type { AnyActorLogic, EventFromLogic, SnapshotFrom } from 'xstate';
import type { EffectActor } from './effectActor.ts';
import type { ActorStoppedError, EventRejectedError } from './errors.ts';

/**
 * Sends one mailbox item and awaits its macrostep publication and immediate
 * effect scheduling. Ignored events are acknowledged too. Does not await
 * invoked work, background actions or future timers. Interrupting the waiter
 * detaches its receipt without retracting the event.
 */
export function sendAndAwait<TLogic extends AnyActorLogic>(
  actor: EffectActor<TLogic>,
  event: EventFromLogic<TLogic>
): Effect.Effect<SnapshotFrom<TLogic>, ActorStoppedError | EventRejectedError> {
  return actor._sendAndAwait(event);
}
