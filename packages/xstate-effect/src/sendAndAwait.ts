import type { Effect } from 'effect';
import type { AnyActorLogic, EventFromLogic, SnapshotFrom } from 'xstate';
import type { EffectActor } from './effectActor.ts';
import type { ActorStoppedError, EventRejectedError } from './errors.ts';

/**
 * Sends one event and acknowledges its transition and immediate effects.
 * Ignored events are acknowledged too, as are events whose actions fail; the
 * failure is processed afterwards. Child replies, invoked work, background
 * action bodies and future timers are not awaited. Interrupting the waiter
 * detaches its receipt without retracting the event.
 *
 * @experimental
 */
export function sendAndAwait<TLogic extends AnyActorLogic>(
  actor: EffectActor<TLogic>,
  event: EventFromLogic<TLogic>
): Effect.Effect<SnapshotFrom<TLogic>, ActorStoppedError | EventRejectedError> {
  return actor._sendAndAwait(event);
}
