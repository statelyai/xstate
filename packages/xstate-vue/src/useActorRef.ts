import { onMounted, onScopeDispose } from 'vue';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  Observer,
  SnapshotFrom,
  Subscription,
  createActor,
  _toObserver as toObserver,
  type IsNotNever,
  type RequiredActorOptionsKeys,
  type RequiredActorOptionsFor
} from 'xstate';

/**
 * Creates an actor from `logic`, or uses an already-created actor (e.g. from
 * `restoreActor`), starting it on mount and stopping it when the owning effect
 * scope is disposed. Create a passed actor once per owning scope.
 *
 * @public
 */
export function useActorRef<TLogic extends AnyActorLogic>(
  actor: Actor<TLogic>,
  observerOrListener?:
    | Observer<SnapshotFrom<TLogic>>
    | ((value: SnapshotFrom<TLogic>) => void)
): Actor<TLogic>;
export function useActorRef<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  ...[options, observerOrListener]: IsNotNever<
    RequiredActorOptionsKeys<TLogic>
  > extends true
    ? [
        options: ActorOptions<TLogic> & RequiredActorOptionsFor<TLogic>,
        observerOrListener?:
          | Observer<SnapshotFrom<TLogic>>
          | ((value: SnapshotFrom<TLogic>) => void)
      ]
    : [
        options?: ActorOptions<TLogic>,
        observerOrListener?:
          | Observer<SnapshotFrom<TLogic>>
          | ((value: SnapshotFrom<TLogic>) => void)
      ]
): Actor<TLogic>;
export function useActorRef(
  logicOrActor: AnyActorLogic | Actor<AnyActorLogic>,
  ...args: any[]
): Actor<AnyActorLogic> {
  const readyActor = logicOrActor instanceof Actor;
  const observerOrListener:
    | Observer<unknown>
    | ((value: unknown) => void)
    | undefined = readyActor ? args[0] : args[1];
  const actorRef = readyActor
    ? logicOrActor
    : createActor(logicOrActor, args[0]);

  let sub: Subscription;
  let disposed = false;
  onMounted(() => {
    if (disposed) {
      return;
    }
    if (observerOrListener) {
      sub = actorRef.subscribe(toObserver(observerOrListener));
    }
    actorRef.start();
  });

  onScopeDispose(() => {
    disposed = true;
    actorRef.stop();
    sub?.unsubscribe();
  });

  return actorRef;
}
