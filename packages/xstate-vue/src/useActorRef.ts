import { onBeforeUnmount, onMounted } from 'vue';
import {
  ActorRefFrom,
  AnyActorLogic,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineImplementations,
  createActor,
  ActorOptions,
  Observer,
  SnapshotFrom,
  StateFrom,
  Subscription,
  toObserver
} from 'xstate';

export type UseActorRefRestParams<TLogic extends AnyActorLogic> = [
  options?: ActorOptions<TLogic>,
  observerOrListener?:
    | Observer<SnapshotFrom<TLogic>>
    | ((value: SnapshotFrom<TLogic>) => void)
];

export function useActorRef<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  ...[options = {}, observerOrListener]: UseActorRefRestParams<TLogic>
): ActorRefFrom<TLogic> {
  const actorRef = createActor(actorLogic, options).start();

  let sub: Subscription;
  onMounted(() => {
    if (observerOrListener) {
      sub = actorRef.subscribe(toObserver(observerOrListener as any));
    }
  });

  onBeforeUnmount(() => {
    actorRef.stop();
    sub?.unsubscribe();
  });

  return actorRef as ActorRefFrom<TLogic>;
}
