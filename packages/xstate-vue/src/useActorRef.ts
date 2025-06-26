import { onBeforeUnmount, onMounted } from 'vue';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  Observer,
  SnapshotFrom,
  Subscription,
  createActor,
  toObserver,
  type IsNotNever,
  type RequiredActorOptionsKeys
} from 'xstate';

export function useActorRef<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  ...[options, observerOrListener]: IsNotNever<
    RequiredActorOptionsKeys<TLogic>
  > extends true
    ? [
        options: ActorOptions<TLogic> & {
          [K in RequiredActorOptionsKeys<TLogic>]: unknown;
        },
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
): Actor<TLogic> {
  const actorRef = createActor(actorLogic, options);

  let sub: Subscription;

  if (observerOrListener) {
    sub = actorRef.subscribe(toObserver(observerOrListener));
  }

  actorRef.start();

  onBeforeUnmount(() => {
    actorRef.stop();
    sub?.unsubscribe();
  });

  return actorRef;
}
