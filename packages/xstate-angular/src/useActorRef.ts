import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  createActor,
  Observer,
  SnapshotFrom,
  Subscription,
  toObserver
} from 'xstate';
import { DestroyRef, inject } from '@angular/core';

export function useActorRef<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  options: ActorOptions<TLogic> = {},
  observerOrListener?:
    | Observer<SnapshotFrom<TLogic>>
    | ((value: SnapshotFrom<TLogic>) => void)
): Actor<TLogic> {
  const actorRef = createActor(actorLogic, options);

  let sub: Subscription;
  if (observerOrListener) {
    sub = actorRef.subscribe(toObserver(observerOrListener));
  }
  actorRef.start();

  inject(DestroyRef).onDestroy(() => {
    actorRef.stop();
    sub?.unsubscribe();
  });

  return actorRef;
}
