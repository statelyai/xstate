import isDevelopment from '#is-development';
import { getTimerKey } from './timerKey.ts';
import {
  type ActorTermination,
  AnyActor,
  AnyActorScope,
  EventObject,
  TimerKey
} from './types';

export function assertSendToEvent(event: EventObject): void {
  if (typeof event === 'string') {
    throw new Error(
      isDevelopment
        ? // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Only event objects may be used with sendTo; use sendTo({ type: "${event}" }) instead`
        : `Only event objects may be used with sendTo`
    );
  }
}

export const builtInActions = {
  // Actor refs are created while resolving the next snapshot. Starting is a
  // separate deferred effect so the returned list remains execution-complete.
  ['@xstate.spawn']: (actor: AnyActor) => {
    return actor.system.spawnActor(actor._parent, actor);
  },
  ['@xstate.start']: (actor: AnyActor) => {
    return actor.system.startActor(actor);
  },
  ['@xstate.raise']: (
    actorScope: AnyActorScope,
    event: EventObject,
    options: { id?: string; seq?: number; delay?: number }
  ) => {
    return actorScope.system.scheduleTimer(
      actorScope.self,
      getTimerKey({ id: options.id, seq: options.seq, event }),
      options?.delay ?? 0
    );
  },
  ['@xstate.sendTo']: (
    actorScope: AnyActorScope,
    actor: AnyActor,
    event: EventObject,
    options: { id?: string; seq?: number; delay?: number }
  ) => {
    assertSendToEvent(event);
    if (options?.delay !== undefined) {
      return actorScope.system.scheduleTimer(
        actorScope.self,
        getTimerKey({ id: options.id, seq: options.seq, event }),
        options?.delay ?? 0
      );
    } else {
      return actorScope.system._relay(actorScope.self, actor, event);
    }
  },
  ['@xstate.cancel']: (actorScope: AnyActorScope, key: TimerKey) => {
    return actorScope.system.cancelTimer(actorScope.self, key);
  },
  ['@xstate.stop']: (actorScope: AnyActorScope, actor: AnyActor) => {
    return actorScope.system.stopActor(actor);
  },
  ['@xstate.terminate']: (actor: AnyActor, termination: ActorTermination) => {
    return actor.system.terminateActor(actor, termination);
  }
};
