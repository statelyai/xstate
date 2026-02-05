import { AnyActorRef, AnyActorScope, EventObject } from './types';

export const builtInActions = {
  ['@xstate.start']: (actorRef: AnyActorRef) => {
    actorRef.start();
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
    actorRef: AnyActorRef,
    event: EventObject,
    options: { id?: string; delay?: number }
  ) => {
    if (typeof event === 'string') {
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Only event objects may be used with sendTo; use sendTo({ type: "${event}" }) instead`
      );
    }
    if (options?.delay !== undefined) {
      actorScope.system.scheduler.schedule(
        actorScope.self,
        actorRef,
        event,
        options?.delay ?? 0,
        options?.id
      );
    } else {
      actorScope.defer(() => {
        actorScope.system._relay(actorScope.self, actorRef, event);
      });
    }
  },
  ['@xstate.cancel']: (actorScope: AnyActorScope, sendId: string) => {
    actorScope.system.scheduler.cancel(actorScope.self, sendId);
  },
  ['@xstate.stopChild']: (actorScope: AnyActorScope, actorRef: AnyActorRef) => {
    actorScope.stopChild(actorRef);
  }
};
