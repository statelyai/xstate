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
  type ConditionalRequired,
  type IsNotNever,
  type RequiredOptions
} from 'xstate';

export function useActorRef<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  options?: ConditionalRequired<
    [
      options?: ActorOptions<TLogic> & {
        [K in RequiredOptions<TLogic>]: unknown;
      }
    ],
    IsNotNever<RequiredOptions<TLogic>>
  >['0'],
  observerOrListener?:
    | Observer<SnapshotFrom<TLogic>>
    | ((value: SnapshotFrom<TLogic>) => void)
): Actor<TLogic> {
  const actorRef = createActor(actorLogic, options);

  let sub: Subscription;
  onMounted(() => {
    if (observerOrListener) {
      sub = actorRef.subscribe(toObserver(observerOrListener));
    }
    actorRef.start();
  });

  onBeforeUnmount(() => {
    actorRef.stop();
    sub?.unsubscribe();
  });

  return actorRef;
}
