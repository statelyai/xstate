import isDevelopment from '#is-development';
import { AnyActor, AnyActorScope, EventObject } from './types';

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
    options: { id?: string; delay?: number }
  ) => {
    return actorScope.system.scheduleEvent(
      actorScope.self,
      actorScope.self,
      event,
      options?.delay ?? 0,
      options?.id
    );
  },
  ['@xstate.sendTo']: (
    actorScope: AnyActorScope,
    actor: AnyActor,
    event: EventObject,
    options: { id?: string; delay?: number }
  ) => {
    if (typeof event === 'string') {
      throw new Error(
        isDevelopment
          ? // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Only event objects may be used with sendTo; use sendTo({ type: "${event}" }) instead`
          : `Only event objects may be used with sendTo`
      );
    }
    if (options?.delay !== undefined) {
      return actorScope.system.scheduleEvent(
        actorScope.self,
        actor,
        event,
        options?.delay ?? 0,
        options?.id
      );
    } else {
      return actorScope.system._relay(actorScope.self, actor, event);
    }
  },
  ['@xstate.cancel']: (actorScope: AnyActorScope, sendId: string) => {
    return actorScope.system.cancelEvent(actorScope.self, sendId);
  },
  ['@xstate.stop']: (actorScope: AnyActorScope, actor: AnyActor) => {
    return actorScope.system.stopActor(actor);
  }
};
