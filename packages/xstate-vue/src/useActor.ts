import isDevelopment from '#is-development';
import {
  effectScope,
  getCurrentScope,
  onScopeDispose,
  Ref,
  shallowRef
} from 'vue';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  Snapshot,
  SnapshotFrom,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys
} from 'xstate';
import { useActorRef } from './useActorRef.ts';

export function useActor<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  ...[options]: ConditionalRequired<
    [
      options?: ActorOptions<TLogic> & {
        [K in RequiredActorOptionsKeys<TLogic>]: unknown;
      }
    ],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): {
  snapshot: Ref<SnapshotFrom<TLogic>>;
  send: Actor<TLogic>['send'];
  actorRef: Actor<TLogic>;
};
export function useActor(
  actorLogic: AnyActorLogic,
  options: ActorOptions<AnyActorLogic> = {}
) {
  if (
    isDevelopment &&
    'send' in actorLogic &&
    typeof actorLogic.send === 'function'
  ) {
    throw new Error(
      `useActor() expects actor logic (e.g. a machine), but received an ActorRef. Use the useSelector(actorRef, ...) hook instead to read the ActorRef's snapshot.`
    );
  }

  const scope = effectScope();

  const result = scope.run(() => {
    const snapshot = shallowRef();

    function listener(nextSnapshot: Snapshot<unknown>) {
      snapshot.value = nextSnapshot;
    }

    const actorRef = useActorRef(actorLogic, options, listener);
    snapshot.value = actorRef.getSnapshot();
    return { snapshot, actorRef, send: actorRef.send };
  });

  if (getCurrentScope()) {
    onScopeDispose(() => {
      scope.stop();
    });
  }

  if (!result) throw new Error('useActor: effectScope did not run correctly');
  return result;
}
