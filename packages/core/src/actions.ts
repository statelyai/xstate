import isDevelopment from '#is-development';
import { AnyActor, AnyActorScope, EventObject } from './types';

export const builtInActions = {
  ['@xstate.start']: (actor: AnyActor) => {
    actor.start();
  },
  ['@xstate.raise']: (
    actorScope: AnyActorScope,
    event: EventObject,
    options: { id?: string; delay?: number }
  ) => {
    actorScope.system.scheduler.schedule(
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
      actorScope.system.scheduler.schedule(
        actorScope.self,
        actor,
        event,
        options?.delay ?? 0,
        options?.id
      );
    } else {
      actorScope.defer(() => {
        actorScope.system._relay(actorScope.self, actor, event);
      });
    }
  },
  ['@xstate.cancel']: (actorScope: AnyActorScope, sendId: string) => {
    actorScope.system.scheduler.cancel(actorScope.self, sendId);
  },
  ['@xstate.stop']: (actorScope: AnyActorScope, actor: AnyActor) => {
    actorScope.stopChild(actor);
  }
};
