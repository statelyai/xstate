import {
  AnyActorRef,
  AnyActorSystem,
  Observer,
  SnapshotFrom,
  Subscribable,
  Subscription
} from './types.js';
import { toObserver } from './utils';

type SystemObservableNext = {
  actorRef: AnyActorRef;
  snapshot: SnapshotFrom<AnyActorRef>;
};

type Subscribe = {
  (observer: Observer<SystemObservableNext>): Subscription;
  (
    nextListener?: (next: SystemObservableNext) => void,
    errorListener?: (error: any) => void,
    completeListener?: () => void
  ): Subscription;
};

export function createSystemObservable(
  system: AnyActorSystem
): Subscribable<SystemObservableNext> {
  const actorSubscriptions = new Map();
  const observers = new Set<Observer<SystemObservableNext>>();

  const onNext = (
    actorRef: AnyActorRef,
    snapshot: SnapshotFrom<AnyActorRef>
  ) => {
    for (const observer of observers) {
      observer.next?.({ actorRef, snapshot });
    }
  };

  const onError = (actorRef: AnyActorRef, error: unknown) => {
    for (const observer of observers) {
      observer.error?.({ actorRef, error });
    }
  };

  const completeActor = (sessionId: string) => {
    actorSubscriptions.delete(sessionId);
    if (actorSubscriptions.size === 0) {
      for (const observer of observers) {
        observer.complete?.();
      }
      observers.clear();
    }
  };

  const subscribeActors = () => {
    for (const [sessionId, actorRef] of system) {
      const sub = actorRef.subscribe({
        next: (snapshot) => onNext(actorRef, snapshot),
        error: (error) => {
          onError(actorRef, error);
          completeActor(sessionId);
        },
        complete: () => {
          completeActor(sessionId);
        }
      });

      actorSubscriptions.set(sessionId, sub);
    }
  };

  const unsubscribeActors = () => {
    for (const [, sub] of actorSubscriptions) {
      sub.unsubscribe();
    }
  };

  const subscribe: Subscribe = (
    nextListenerOrObserver?:
      | ((next: SystemObservableNext) => void)
      | Observer<SystemObservableNext>,
    errorListener?: (error: any) => void,
    completeListener?: () => void
  ) => {
    if (observers.size === 0) {
      subscribeActors();
    }

    const observer = toObserver(
      nextListenerOrObserver,
      errorListener,
      completeListener
    );

    observers.add(observer);

    return {
      unsubscribe: () => {
        observers.delete(observer);

        if (observers.size === 0) unsubscribeActors();
      }
    };
  };

  return {
    subscribe
  };
}
