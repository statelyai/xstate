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
import {
  afterNextRender,
  AfterRenderPhase,
  DestroyRef,
  inject
} from '@angular/core';

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

  afterNextRender(
    () => {
      actorRef.start();
    },
    { phase: AfterRenderPhase.Read }
  );

  inject(DestroyRef).onDestroy(() => {
    actorRef.stop();
    sub?.unsubscribe();
  });

  return actorRef;
}
