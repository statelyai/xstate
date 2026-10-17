import type { AnyActor, EventObject, TimerKey } from './types.ts';

type TimerIdentity = { id?: string; seq?: number; event: EventObject };

/**
 * @internal The identity fields of a built-in timer event (`after`, state and
 * invoke `timeout`), or `undefined` for any other event.
 */
export function getBuiltInTimerIdentity(
  event: EventObject
): EventObject | undefined {
  const { stateId, delay, actorId } = event as {
    stateId?: unknown;
    delay?: unknown;
    actorId?: unknown;
  };
  switch (event.type) {
    case 'xstate.after':
      return { type: event.type, stateId, delay } as EventObject;
    case 'xstate.timeout.state':
      return { type: event.type, stateId } as EventObject;
    case 'xstate.timeout.actor':
      return { type: event.type, actorId } as EventObject;
  }
  return undefined;
}

/** @internal The key of a logical timer, effect or cancellation. */
export function getTimerKey(timer: TimerIdentity): TimerKey {
  if (timer.id !== undefined) {
    return { id: timer.id };
  }
  if (timer.seq !== undefined) {
    return { seq: timer.seq };
  }
  return { event: getBuiltInTimerIdentity(timer.event) ?? timer.event };
}

/**
 * @internal Reads the timer key carried by a firing input or cancellation
 * (`{ id }`, `{ seq }` or `{ event }` fields).
 */
export function readTimerKey(input: object): TimerKey | undefined {
  const value = input as { id?: unknown; seq?: unknown; event?: unknown };
  if (typeof value.id === 'string') {
    return { id: value.id };
  }
  if (typeof value.seq === 'number') {
    return { seq: value.seq };
  }
  if (
    value.event &&
    typeof value.event === 'object' &&
    typeof (value.event as EventObject).type === 'string'
  ) {
    return { event: value.event as EventObject };
  }
  return undefined;
}

/** @internal Whether a logical timer has the given key. */
export function matchesTimerKey(timer: TimerIdentity, key: TimerKey): boolean {
  if ('id' in key) {
    return timer.id === key.id;
  }
  if (timer.id !== undefined) {
    return false;
  }
  if ('seq' in key) {
    return timer.seq === key.seq;
  }
  if (timer.seq !== undefined) {
    return false;
  }
  const event = timer.event as unknown as Record<string, unknown>;
  const pattern = key.event as unknown as Record<string, unknown>;
  for (const field in pattern) {
    if (event[field] !== pattern[field]) {
      return false;
    }
  }
  return true;
}

/** @internal A private string form of a timer key, for in-memory maps. */
export function serializeTimerKey(key: TimerKey): string {
  if ('id' in key) {
    return JSON.stringify(['id', key.id]);
  }
  if ('seq' in key) {
    return JSON.stringify(['seq', key.seq]);
  }
  return JSON.stringify([
    'event',
    getBuiltInTimerIdentity(key.event) ?? key.event
  ]);
}

/** @internal The private local-scheduler key of an actor's logical timer. */
export function getScheduledTimerKey(actor: AnyActor, key: TimerKey): string {
  return `${actor.sessionId}|${serializeTimerKey(key)}`;
}
